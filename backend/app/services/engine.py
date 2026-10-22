import math
import re
from typing import Any, Dict, List, Optional, Set


# Нормальный линейный уровень (дБu) на входе усилителя или активной АС.
LINE_MIN_DBU = -10
LINE_MAX_DBU = 20

AUDIO_SOURCES = ('microphone', 'array_microphone', 'wireless_mic')
VIDEO_SOURCES = ('camera', 'media_player')
AUDIO_SINKS = ('speaker', 'subwoofer')
VIDEO_SINKS = ('display', 'projector')
# Каскады с регулируемым усилением: предусилитель входа + выходной уровень
GAIN_STAGES = ('mixer', 'dsp', 'audio_interface')

# Уровень микрофона без указанной чувствительности, дБu
MIC_LEVEL_DBU = -50
# Цифровой выход Dante микрофонного массива — номинальный линейный уровень, дБu
ARRAY_MIC_LEVEL_DBU = 4
# Перевод дБВ (чувствительность микрофона) в дБu
DBV_TO_DBU = 2.2

# Сигналы, которые устройство «понимает» как аудио или видео
NATIVE = {
    'audio': {'analog_audio', 'digital_audio', 'usb'},
    'video': {'hdmi', 'sdi', 'video'},
}
# Сигналы, по которым аудио или видео идёт по кабелю (включая IP: Dante, AV-over-IP)
TRANSPORT = {
    'audio': {'analog_audio', 'digital_audio', 'usb', 'network'},
    'video': {'hdmi', 'sdi', 'video', 'network'},
}

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
    'speaker': 'колонка',
    'subwoofer': 'сабвуфер',
    'display': 'дисплей',
    'projector': 'проектор',
}
ACTIVE_RU = {'speaker': 'активная колонка', 'subwoofer': 'активный сабвуфер'}
PASSIVE_RU = {'speaker': 'пассивная колонка', 'subwoofer': 'пассивный сабвуфер'}

# Рекомендуемая максимальная длина кабеля (метры) по типу разъёма.
CABLE_MAX_LENGTH = {
    'xlr': 100, 'trs': 15, 'speakon': 50, 'hdmi': 15,
    'sdi': 100, 'cat6': 100, 'rca': 10, 'bnc': 100, 'usb': 5,
}

RES_ALIASES = (
    ('8k', 7680, 4320),
    ('4k', 3840, 2160),
    ('uhd', 3840, 2160),
    ('2160p', 3840, 2160),
    ('1440p', 2560, 1440),
    ('wuxga', 1920, 1200),
    ('1200p', 1920, 1200),
    ('fhd', 1920, 1080),
    ('1080p', 1920, 1080),
    ('1080i', 1920, 1080),
    ('720p', 1280, 720),
)
RES_PATTERN = re.compile(r'^(\d{3,5})\s*[x×]\s*(\d{3,5})')


def is_num(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def num(value: Any, fallback: float) -> float:
    """Число из параметра устройства; пустое/некорректное значение заменяется значением по умолчанию."""
    return value if is_num(value) else fallback


def positive(value: Any, fallback: float) -> float:
    n = num(value, fallback)
    return n if n > 0 else fallback


def round1(x: float) -> float:
    # Как Math.round(x * 10) / 10 в TypeScript-движке (округление половины вверх)
    return math.floor(x * 10 + 0.5) / 10


def js_num(x: Any) -> str:
    """Число в тексте сообщения так же, как его печатает JavaScript: 4.0 → «4»."""
    if isinstance(x, float) and x.is_integer():
        return str(int(x))
    return str(x)


def port_name(port_id: str) -> str:
    return port_id.replace('_', ' ').upper()


def parse_resolution(value: Any) -> Optional[Dict[str, int]]:
    """Разрешение из строки: '3840x2160', '1920×1080', '4K60', '1080p' и т. п."""
    if not isinstance(value, str):
        return None
    s = value.strip().lower()
    m = RES_PATTERN.match(s)
    if m:
        return {'w': int(m.group(1)), 'h': int(m.group(2))}
    for alias, w, h in RES_ALIASES:
        if s.startswith(alias):
            return {'w': w, 'h': h}
    return None


def fmt_res(r: Dict[str, int]) -> str:
    return f"{r['w']}×{r['h']}"


def signals_compatible(a: str, b: str) -> bool:
    if a == b:
        return True
    return a in IP_SIGNALS and b in IP_SIGNALS


class SimulationEngine:
    """Движок симуляции сигнальных трактов AV-системы.

    Точный аналог frontend/src/sim/engine.ts — результаты должны совпадать
    независимо от того, где выполнен расчёт (сервер или браузер). Совпадение
    проверяют общие тестовые схемы из shared/sim-fixtures.
    """

    def __init__(self):
        self.devices: Dict[str, Dict] = {}
        self.connections: List[Dict] = []

    def load_topology(self, devices: List, connections: List):
        self.devices = {d.id if hasattr(d, 'id') else d['id']: d for d in devices}
        self.connections = connections

    def run_simulation(self) -> Dict:
        graph = self._build_signal_graph()
        warnings: List[Dict] = []
        errors: List[Dict] = []
        # Одна и та же проблема на общем участке нескольких ветвей выводится один раз
        seen: Set[str] = set()

        def add_flow_warning(issue: Dict):
            key = f"{issue['type']}|{issue['device']}"
            if key in seen:
                return
            seen.add(key)
            warnings.append(issue)

        # --- Аудиоцепочки: все ветви от каждого источника ---
        audio_flows = []
        for dev_id, dev in self.devices.items():
            if self._type(dev) not in AUDIO_SOURCES:
                continue
            for path in self._trace_paths(dev_id, 'audio', graph):
                level, at, issues = self._analyze_audio_path(path)
                for issue in issues:
                    add_flow_warning(issue)
                audio_flows.append({
                    'type': 'audio',
                    'source': dev_id,
                    'path': path,
                    'final_level_db': level,
                    'level_at': at,
                    'status': 'warning' if issues else 'ok',
                })

        # --- Видеоцепочки (с учётом масштабирования и поддерживаемого разрешения) ---
        video_flows = []
        for dev_id, dev in self.devices.items():
            if self._type(dev) not in VIDEO_SOURCES:
                continue
            for path in self._trace_paths(dev_id, 'video', graph):
                resolution, issues = self._analyze_video_path(path)
                for issue in issues:
                    add_flow_warning(issue)
                video_flows.append({
                    'type': 'video',
                    'source': dev_id,
                    'path': path,
                    'resolution': resolution,
                    'status': 'warning' if issues else 'ok',
                })

        self._check_issues(warnings, errors)
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
            if not from_device:
                continue
            graph.setdefault(from_device, []).append({
                'id': conn.get('id'),
                'to': conn.get('to', {}).get('device'),
                'from_port': conn.get('from', {}).get('port'),
                'to_port': conn.get('to', {}).get('port'),
            })
        return graph

    def _hop_allowed(self, from_dev, hop: Dict, to_dev, domain: str) -> bool:
        """Может ли аудио/видео пройти по кабелю hop от устройства from_dev к to_dev."""
        if to_dev is None:
            return False
        from_port = self._find_port(from_dev, hop['from_port'])
        if from_port is not None:
            sig = self._port_attr(from_port, 'signal_type')
            if sig not in TRANSPORT[domain]:
                return False
            # LAN-порт оконечного устройства служит для управления, а не для медиапотока
            if (self._port_attr(from_port, 'direction') == 'bidirectional' and sig == 'network'
                    and self._type(from_dev) != 'network_switch'):
                return False
        to_ports = self._ports(to_dev)
        if self._type(to_dev) == 'network_switch' or len(to_ports) == 0:
            return True
        return any(self._port_attr(p, 'signal_type') in NATIVE[domain] for p in to_ports)

    def _trace_paths(self, source_id: str, domain: str, graph: Dict) -> List[List[str]]:
        """Все ветви сигнала от источника: обход в глубину по всем кабелям."""
        visited: Set[str] = {source_id}
        paths: List[List[str]] = []

        def walk(path: List[str]):
            node = path[-1]
            extended = False
            for hop in graph.get(node, []):
                if hop['to'] in visited:
                    continue
                if not self._hop_allowed(self.devices[node], hop, self.devices.get(hop['to']), domain):
                    continue
                visited.add(hop['to'])
                extended = True
                walk(path + [hop['to']])
            if not extended:
                paths.append(path)

        walk([source_id])
        return paths

    # ------- Аудио -------
    def _start_level(self, dev) -> float:
        p = self._props(dev)
        if self._type(dev) == 'array_microphone':
            return ARRAY_MIC_LEVEL_DBU
        sens = p.get('sensitivity')
        base = sens + DBV_TO_DBU if is_num(sens) else MIC_LEVEL_DBU
        return base - abs(num(p.get('pad'), 0))

    def _stage_gain(self, dev) -> float:
        t = self._type(dev)
        p = self._props(dev)
        if t == 'mixer':
            return num(p.get('input_gain'), 0) + num(p.get('master_gain'), 0)
        if t == 'dsp':
            return num(p.get('input_gain'), 0) + num(p.get('gain'), 0)
        if t == 'audio_interface':
            return num(p.get('input_gain'), 0)
        return 0

    def _analyze_audio_path(self, path: List[str]):
        """Уровень сигнала вдоль ветви; контрольная точка — вход усилителя/АС или конец ветви."""
        src = self.devices[path[0]]
        level = self._start_level(src)
        measure_idx = -1
        for i in range(1, len(path)):
            t = self._type(self.devices[path[i]])
            if t == 'amplifier' or t in AUDIO_SINKS:
                measure_idx = i
                break
        end = len(path) if measure_idx == -1 else measure_idx
        last_stage = None
        clip = None
        for i in range(1, end):
            d = self.devices[path[i]]
            if self._type(d) not in GAIN_STAGES:
                continue
            level = level + self._stage_gain(d)
            last_stage = d
            if clip is None and level > LINE_MAX_DBU:
                clip = (path[i], d, level)
        at_id = path[-1] if measure_idx == -1 else path[measure_idx]
        at = self.devices[at_id]
        issues: List[Dict] = []
        if len(path) > 1:
            lvl = js_num(round1(level))
            if clip is not None:
                issues.append({
                    'type': 'level_high',
                    'device': clip[0],
                    'message': f"Перегрузка: {js_num(round1(clip[2]))} дБu на выходе «{self._model(clip[1])}» — выше +{LINE_MAX_DBU} дБu, уменьшите усиление",
                    'severity': 'medium',
                })
            elif level > LINE_MAX_DBU:
                issues.append({
                    'type': 'level_high',
                    'device': at_id,
                    'message': f"Перегрузка: {lvl} дБu на «{self._model(at)}» — выше +{LINE_MAX_DBU} дБu, уменьшите уровень источника",
                    'severity': 'medium',
                })
            if level < LINE_MIN_DBU:
                if last_stage is not None:
                    message = (f"Слабый сигнал: {lvl} дБu на «{self._model(at)}» (норма {LINE_MIN_DBU}…+{LINE_MAX_DBU} дБu)"
                               f" — увеличьте усиление «{self._model(last_stage)}»")
                else:
                    message = (f"Слабый сигнал: {lvl} дБu на «{self._model(at)}» — микрофонный уровень нужно"
                               f" поднять предусилителем (микшер, DSP, аудиоинтерфейс)")
                issues.append({
                    'type': 'level_low',
                    'device': self._id_of(last_stage) if last_stage is not None else path[0],
                    'message': message,
                    'severity': 'medium',
                })
        return round1(level), at_id, issues

    # ------- Видео -------
    def _analyze_video_path(self, path: List[str]):
        """Разрешение вдоль ветви: масштабаторы меняют его, коммутаторы и приёмники проверяют."""
        src_res = self._props(self.devices[path[0]]).get('resolution')
        resolution = src_res if isinstance(src_res, str) else '1920x1080'
        issues: List[Dict] = []
        for dev_id in path[1:]:
            d = self.devices[dev_id]
            p = self._props(d)
            sig = parse_resolution(resolution)
            if self._type(d) in VIDEO_SINKS:
                native = parse_resolution(p.get('resolution'))
                if sig and native and sig['w'] * sig['h'] > native['w'] * native['h']:
                    issues.append({
                        'type': 'resolution_downscale',
                        'device': dev_id,
                        'message': f"Сигнал {fmt_res(sig)} выше родного разрешения {fmt_res(native)} у «{self._model(d)}» — изображение будет уменьшено",
                        'severity': 'low',
                    })
            else:
                max_res = parse_resolution(p.get('max_resolution'))
                if sig and max_res and sig['w'] * sig['h'] > max_res['w'] * max_res['h']:
                    issues.append({
                        'type': 'resolution_unsupported',
                        'device': dev_id,
                        'message': f"«{self._model(d)}» принимает до {fmt_res(max_res)}, а источник выдаёт {fmt_res(sig)} — понизьте разрешение источника (EDID) или поставьте масштабатор",
                        'severity': 'medium',
                    })
                res_out = p.get('resolution_out')
                if isinstance(res_out, str) and res_out:
                    resolution = res_out
        return resolution, issues

    # ------- Проверки -------
    def _check_issues(self, warnings: List[Dict], errors: List[Dict]):
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
                    'connection': conn.get('id'),
                    'message': f"Несовместимые сигналы: {SIG_RU.get(from_sig, from_sig)} → {SIG_RU.get(to_sig, to_sig)}",
                    'severity': 'high',
                })

        # В один вход (или Ethernet-порт) подключено несколько кабелей
        for dev_id, dev in self.devices.items():
            for port in self._ports(dev):
                direction = self._port_attr(port, 'direction')
                if direction == 'output':
                    continue
                port_id = self._port_attr(port, 'id')
                using = [
                    c for c in self.connections
                    if (c.get('to', {}).get('device') == dev_id and c.get('to', {}).get('port') == port_id)
                    or (direction == 'bidirectional' and c.get('from', {}).get('device') == dev_id
                        and c.get('from', {}).get('port') == port_id)
                ]
                if len(using) > 1:
                    errors.append({
                        'type': 'input_busy',
                        'device': dev_id,
                        'connection': using[-1].get('id'),
                        'message': f"К порту {port_name(port_id)} устройства «{self._model(dev)}» подключено несколько кабелей ({len(using)}) — в разъём входит только один",
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
                        'message': f"«{self._model(dev)}» — {ACTIVE_RU[self._type(dev)]} со встроенным усилителем: к выходу усилителя мощности не подключается, подайте линейный сигнал",
                        'severity': 'high',
                    })
                elif active is False and self._type(from_dev) != 'amplifier':
                    errors.append({
                        'type': 'passive_no_amp',
                        'device': dev_id,
                        'message': f"«{self._model(dev)}» — {PASSIVE_RU[self._type(dev)]}: нужен усилитель мощности",
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

        # Бюджет мощности: усилитель → пассивные АС
        for amp_id, amp in self.devices.items():
            if self._type(amp) != 'amplifier':
                continue
            amp_w = num(self._props(amp).get('power_watts'), 0)
            min_ohm = num(self._props(amp).get('min_impedance_ohms'), 4)
            by_port: Dict[str, List] = {}
            for conn in self.connections:
                if conn.get('from', {}).get('device') != amp_id:
                    continue
                sink = self.devices.get(conn.get('to', {}).get('device'))
                if not sink:
                    continue
                if self._type(sink) in AUDIO_SINKS and self._props(sink).get('active') is False:
                    by_port.setdefault(conn['from']['port'], []).append(sink)
            for spks in by_port.values():
                impedances = [positive(self._props(s).get('impedance_ohms'), 8) for s in spks]
                parallel = 1 / sum(1 / z for z in impedances)
                load = round1(parallel)
                total = sum(num(self._props(s).get('power_handling_watts'), 0) for s in spks)
                if parallel + 1e-9 < min_ohm:
                    errors.append({
                        'type': 'impedance_low',
                        'device': amp_id,
                        'message': f"Нагрузка {js_num(load)} Ω на «{self._model(amp)}» ниже минимума {js_num(min_ohm)} Ω — риск перегрузки и срабатывания защиты",
                        'severity': 'high',
                    })
                if total > 0 and amp_w > 0:
                    if amp_w > total * 2:
                        warnings.append({
                            'type': 'power_over',
                            'device': amp_id,
                            'message': f"Усилитель {js_num(amp_w)} Вт мощнее суммарной мощности АС {js_num(total)} Вт — риск повреждения на высокой громкости",
                            'severity': 'medium',
                        })
                    elif amp_w * 2 < total:
                        warnings.append({
                            'type': 'power_under',
                            'device': amp_id,
                            'message': f"Усилитель {js_num(amp_w)} Вт недостаточен для АС {js_num(total)} Вт — возможен клиппинг",
                            'severity': 'medium',
                        })

        # Длина кабеля
        for conn in self.connections:
            cable = conn.get('cable_type')
            length = num(conn.get('cable_length'), 0)
            max_len = CABLE_MAX_LENGTH.get(cable, 100)
            if length > max_len:
                warnings.append({
                    'type': 'cable_length',
                    'device': conn.get('from', {}).get('device'),
                    'connection': conn.get('id'),
                    'message': f"Кабель {str(cable).upper()} {js_num(length)} м превышает рекомендуемые {max_len} м — возможны потери сигнала",
                    'severity': 'low',
                })

        # Приёмник без входного подключения
        for dev_id, dev in self.devices.items():
            t = self._type(dev)
            if t in (AUDIO_SINKS + VIDEO_SINKS) and not self._incoming(dev_id):
                errors.append({
                    'type': 'no_input',
                    'device': dev_id,
                    'message': f"На вход «{self._model(dev)}» ({SINK_RU.get(t, t)}) не подан сигнал — подключите источник",
                    'severity': 'high',
                })

    # ------- Вспомогательное -------
    def _incoming(self, dev_id: str) -> List[Dict]:
        return [c for c in self.connections if c.get('to', {}).get('device') == dev_id]

    def _incident(self, dev_id: str) -> List[Dict]:
        return [
            c for c in self.connections
            if c.get('to', {}).get('device') == dev_id or c.get('from', {}).get('device') == dev_id
        ]

    def _find_port(self, device, port_id):
        for p in self._ports(device):
            if self._port_attr(p, 'id') == port_id:
                return p
        return None

    def _port_signal(self, dev_id, port_id) -> Optional[str]:
        dev = self.devices.get(dev_id)
        if not dev:
            return None
        port = self._find_port(dev, port_id)
        return self._port_attr(port, 'signal_type') if port is not None else None

    @staticmethod
    def _port_attr(port, name: str):
        return port.get(name) if isinstance(port, dict) else getattr(port, name, None)

    def _id_of(self, device) -> str:
        return device.id if hasattr(device, 'id') else device.get('id', '')

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
