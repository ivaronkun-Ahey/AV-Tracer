import { Device, Connection, SimulationResult, SignalFlow, SimIssue } from '../types/device.types';

/**
 * Клиентский движок симуляции — точный аналог backend/app/services/engine.py.
 * Используется как резерв, когда Python-сервер недоступен, чтобы функция
 * «Симуляция» работала всегда, без обязательного запуска бэкенда.
 */

interface Hop {
  to: string;
  from_port: string;
  to_port: string;
}
type Graph = Record<string, Hop[]>;

function buildGraph(connections: Connection[]): Graph {
  const graph: Graph = {};
  for (const c of connections) {
    if (!c.from?.device) continue;
    (graph[c.from.device] ||= []).push({
      to: c.to.device,
      from_port: c.from.port,
      to_port: c.to.port,
    });
  }
  return graph;
}

function nextHop(graph: Graph, node: string): string | null {
  const hops = graph[node];
  if (!hops || hops.length === 0) return null;
  return hops[0].to || null;
}

function processAudio(device: Device, level: number): number {
  const p = device.properties || {};
  if (device.type === 'mixer') return level + (p.gain ?? p.master_gain ?? 0);
  if (device.type === 'amplifier') return level + (p.gain ?? 20);
  return level;
}

function tracePath(start: string, graph: Graph): string[] {
  const path = [start];
  let current = start;
  const visited = new Set<string>();
  while (!visited.has(current)) {
    visited.add(current);
    const next = nextHop(graph, current);
    if (!next) break;
    path.push(next);
    current = next;
  }
  return path;
}

export function runSimulation(devices: Device[], connections: Connection[]): SimulationResult {
  const byId: Record<string, Device> = {};
  for (const d of devices) byId[d.id] = d;
  const graph = buildGraph(connections);

  // Аудиоцепочки: источники — микрофоны
  const audioFlows: SignalFlow[] = [];
  for (const d of devices) {
    if (d.type !== 'microphone' && d.type !== 'array_microphone') continue;
    let level = -60.0;
    const path = [d.id];
    let current = d.id;
    const visited = new Set<string>();
    while (!visited.has(current)) {
      visited.add(current);
      const next = nextHop(graph, current);
      if (!next || !byId[next]) break;
      level = processAudio(byId[next], level);
      path.push(next);
      current = next;
    }
    audioFlows.push({
      type: 'audio',
      source: d.id,
      path,
      final_level_db: Math.round(level * 10) / 10,
      status: level >= -10 && level <= 10 ? 'ok' : 'warning',
    });
  }

  // Видеоцепочки: источники — камеры
  const videoFlows: SignalFlow[] = [];
  for (const d of devices) {
    if (d.type !== 'camera') continue;
    videoFlows.push({
      type: 'video',
      source: d.id,
      path: tracePath(d.id, graph),
      resolution: (d.properties || {}).resolution ?? '1920x1080',
      status: 'ok',
    });
  }

  // Предупреждения: конденсаторный микрофон без фантомного питания
  const warnings: SimIssue[] = [];
  for (const d of devices) {
    if (d.type === 'microphone' && d.specs?.requires_phantom && !d.properties?.phantom_power) {
      warnings.push({
        type: 'phantom_power',
        device: d.id,
        message: 'Конденсаторному микрофону требуется фантомное питание (+48V)',
        severity: 'medium',
      });
    }
  }

  // Ошибки: приёмник сигнала без входного подключения
  const errors: SimIssue[] = [];
  const hasInput = (id: string) => connections.some((c) => c.to.device === id);
  const sinkLabel: Record<string, string> = {
    speaker: 'Колонка',
    display: 'Дисплей',
    projector: 'Проектор',
  };
  for (const d of devices) {
    if (['speaker', 'display', 'projector'].includes(d.type) && !hasInput(d.id)) {
      errors.push({
        type: 'no_input',
        device: d.id,
        message: `${sinkLabel[d.type] || d.type} «${d.model}» не подключён ко входному сигналу`,
        severity: 'high',
      });
    }
  }

  return {
    valid: errors.length === 0,
    signal_flows: [...audioFlows, ...videoFlows],
    warnings,
    errors,
    computed_by: 'local',
  };
}
