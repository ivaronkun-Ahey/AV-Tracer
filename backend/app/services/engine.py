from typing import List, Dict, Set, Optional


AUDIO_SOURCES = ('microphone', 'array_microphone', 'wireless_mic')
VIDEO_SOURCES = ('camera', 'media_player')
AUDIO_SINKS = ('speaker', 'subwoofer')
VIDEO_SINKS = ('display', 'projector')

# Сигналы, физически передаваемые по сети/IP (Dante, AV-over-IP).
IP_SIGNALS = {'network', 'digital_audio'}

SIG_RU = {
    'analog_audio': 'аналог. аудио',
    'digital_audio': 'цифр. аудио',
    'video': 'видео',
    'hdmi': 'HDMI',
    'sdi': 'SDI',
    'network': 'сеть',
    'control': 'управление',
    'usb': 'USB',
}

SINK_RU = {
    'speaker': 'Колонка',
    'subwoofer': 'Сабвуфер',
    'display': 'Дисплей',
    'projector': 'Проектор',
}


def signals_compatible(a: str, b: str) -> bool:
    if a == b:
        return True
    return a in IP_SIGNALS and b in IP_SIGNALS


class SimulationEngine:
    """Движок симуляции сигнальных трактов AV-системы.

    Точный аналог frontend/src/sim/engine.ts — результаты должны совпадать
    независимо от того, где выполнен расчёт (сервер или браузер).
    """

    def __init__(self):
        self.devices: Dict[str, Dict] = {}
        self.connections: List[Dict] = []

    def load_topology(self, devices: List, connections: List):
        self.devices = {d.id if hasattr(d, 'id') else d['id']: d for d in devices}
        self.connections = connections

    def run_simulation(self) -> Dict:
        graph = self._build_signal_graph()
        audio_flows = self._simulate_audio_chains(graph)
        video_flows = self._simulate_video_chains(graph)
        warnings, errors = self._check_issues()
        return {
            "valid": len(errors) == 0,
            "signal_flows": audio_flows + video_flows,
            "warnings": warnings,
            "errors": errors,
        }

    # ------- Граф -------
    def _build_signal_graph(self) -> Dict[str, List[Dict]]:
        graph: Dict[str, List[Dict]] = {}
        for conn in self.connections:
            from_device = conn.get('from', {}).get('device')
            to_device = conn.get('to', {}).get('device')
            from_port = conn.get('from', {}).get('port')
            to_port = conn.get('to', {}).get('port')
            if not from_device:
                continue
            graph.setdefault(from_device, []).append({
                'to': to_device,
                'from_port': from_port,
                'to_port': to_port,
            })
        return graph

    def _next_hop(self, graph: Dict, node: str) -> Optional[str]:
        hops = graph.get(node)
        if not hops:
            return None
        return hops[0]['to']

    # ------- Аудио -------
    def _simulate_audio_chains(self, graph: Dict) -> List[Dict]:
        flows = []
        for dev_id, dev in self.devices.items():
            if self._type(dev) not in AUDIO_SOURCES:
                continue
            level = -50.0 if self._type(dev) == 'wireless_mic' else -60.0
            path = [dev_id]
            current = dev_id
            visited: Set[str] = set()
            while current not in visited:
                visited.add(current)
                nxt = self._next_hop(graph, current)
                if not nxt or nxt not in self.devices:
                    break
                level = self._process_audio(self.devices[nxt], level)
                path.append(nxt)
                current = nxt
            flows.append({
                'type': 'audio',
                'source': dev_id,
                'path': path,
                'final_level_db': round(level, 1),
                'status': 'ok' if -10 <= level <= 10 else 'warning',
            })
        return flows

    def _process_audio(self, device, level: float) -> float:
        t = self._type(device)
        p = self._props(device)
        if t == 'mixer':
            return level + (p.get('gain') if p.get('gain') is not None else p.get('master_gain', 0))
        if t == 'amplifier':
            return level + p.get('gain', 20)
        if t == 'dsp':
            return level + p.get('gain', 0)
        return level

    # ------- Видео -------
    def _simulate_video_chains(self, graph: Dict) -> List[Dict]:
        flows = []
        for dev_id, dev in self.devices.items():
            if self._type(dev) not in VIDEO_SOURCES:
                continue
            resolution = self._props(dev).get('resolution', '1920x1080')
            path = [dev_id]
            current = dev_id
            visited: Set[str] = set()
            while current not in visited:
                visited.add(current)
                nxt = self._next_hop(graph, current)
                if not nxt or nxt not in self.devices:
                    break
                res_out = self._props(self.devices[nxt]).get('resolution_out')
                if res_out:
                    resolution = res_out
                path.append(nxt)
                current = nxt
            flows.append({
                'type': 'video',
                'source': dev_id,
                'path': path,
                'resolution': resolution,
                'status': 'ok',
            })
        return flows

    # ------- Проверки -------
    def _check_issues(self):
        warnings: List[Dict] = []
        errors: List[Dict] = []

        # Фантомное питание
        for dev_id, dev in self.devices.items():
            if self._specs(dev).get('requires_phantom') and self._props(dev).get('phantom_power') is False:
                warnings.append({
                    'type': 'phantom_power',
                    'device': dev_id,
                    'message': (
                        'Конденсаторному микрофону требуется фантомное питание (+48V)'
                        if self._type(dev) == 'microphone'
                        else 'Устройству требуется фантомное питание (+48V)'
                    ),
                    'severity': 'medium',
                })

        # Несовместимость сигналов на соединении
        for conn in self.connections:
            f = conn.get('from', {})
            t = conn.get('to', {})
            from_sig = self._port_signal(f.get('device'), f.get('port'))
            to_sig = self._port_signal(t.get('device'), t.get('port'))
            if from_sig and to_sig and not signals_compatible(from_sig, to_sig):
                errors.append({
                    'type': 'signal_mismatch',
                    'device': f.get('device'),
                    'message': f"Несовместимые сигналы: {SIG_RU.get(from_sig, from_sig)} → {SIG_RU.get(to_sig, to_sig)}",
                    'severity': 'high',
                })

        # Активные/пассивные АС и сабвуферы относительно усилителя
        for dev_id, dev in self.devices.items():
            if self._type(dev) not in AUDIO_SINKS:
                continue
            active = self._props(dev).get('active')
            for conn in self._incoming(dev_id):
                from_dev = self.devices.get(conn.get('from', {}).get('device'))
                if not from_dev:
                    continue
                if active is True and self._type(from_dev) == 'amplifier':
                    errors.append({
                        'type': 'active_on_amp',
                        'device': dev_id,
                        'message': f"{SINK_RU[self._type(dev)]} «{self._model(dev)}» активный — его нельзя подключать к выходу усилителя, подайте линейный сигнал",
                        'severity': 'high',
                    })
                elif active is False and self._type(from_dev) != 'amplifier':
                    errors.append({
                        'type': 'passive_no_amp',
                        'device': dev_id,
                        'message': f"{SINK_RU[self._type(dev)]} «{self._model(dev)}» пассивный — ему требуется усилитель мощности",
                        'severity': 'high',
                    })

        # Питание PoE
        for dev_id, dev in self.devices.items():
            needs_poe = self._specs(dev).get('requires_poe') or self._props(dev).get('requires_poe')
            if not needs_poe:
                continue
            for conn in self._incident(dev_id):
                other_id = conn['from']['device'] if conn['to']['device'] == dev_id else conn['to']['device']
                other = self.devices.get(other_id)
                if other and self._type(other) == 'network_switch' and self._props(other).get('poe') is False:
                    warnings.append({
                        'type': 'no_poe',
                        'device': dev_id,
                        'message': f"«{self._model(dev)}» требует питания PoE, но коммутатор «{self._model(other)}» его не подаёт",
                        'severity': 'medium',
                    })

        # Приёмник без входного подключения
        for dev_id, dev in self.devices.items():
            t = self._type(dev)
            if t in (AUDIO_SINKS + VIDEO_SINKS) and not self._incoming(dev_id):
                errors.append({
                    'type': 'no_input',
                    'device': dev_id,
                    'message': f"{SINK_RU.get(t, t)} «{self._model(dev)}» не подключён ко входному сигналу",
                    'severity': 'high',
                })

        return warnings, errors

    # ------- Вспомогательное -------
    def _incoming(self, dev_id: str) -> List[Dict]:
        return [c for c in self.connections if c.get('to', {}).get('device') == dev_id]

    def _incident(self, dev_id: str) -> List[Dict]:
        return [
            c for c in self.connections
            if c.get('to', {}).get('device') == dev_id or c.get('from', {}).get('device') == dev_id
        ]

    def _port_signal(self, dev_id, port_id) -> Optional[str]:
        dev = self.devices.get(dev_id)
        if not dev:
            return None
        for p in self._ports(dev):
            if (p.get('id') if isinstance(p, dict) else getattr(p, 'id', None)) == port_id:
                return p.get('signal_type') if isinstance(p, dict) else getattr(p, 'signal_type', None)
        return None

    def _type(self, device) -> str:
        return device.type if hasattr(device, 'type') else device.get('type', '')

    def _model(self, device) -> str:
        return device.model if hasattr(device, 'model') else device.get('model', '')

    def _props(self, device) -> Dict:
        return device.properties if hasattr(device, 'properties') else device.get('properties', {}) or {}

    def _specs(self, device) -> Dict:
        if hasattr(device, 'specs'):
            return getattr(device, 'specs', {}) or {}
        return device.get('specs', {}) or {}

    def _ports(self, device) -> List:
        return device.ports if hasattr(device, 'ports') else device.get('ports', []) or []
