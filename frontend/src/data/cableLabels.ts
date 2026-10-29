import { CableType, Connection, Device, SignalType } from '../types/device.types';

/**
 * Маркировка кабелей, как в кабельном журнале: буква по назначению и номер.
 * A — аналоговое аудио, S — акустический (усилитель → АС), D — Dante,
 * V — видео, N — сеть, C — управление, U — USB, L — трансляционная линия 100 В.
 */
export function cablePrefix(signal: SignalType | undefined, cable: CableType): string {
  if (cable === 'speakon') return 'S';
  if (signal === 'line_100v') return 'L';
  switch (signal) {
    case 'analog_audio':
      return 'A';
    case 'digital_audio':
      return 'D';
    case 'hdmi':
    case 'sdi':
    case 'hdbaset':
    case 'video':
      return 'V';
    case 'network':
      return 'N';
    case 'control':
      return 'C';
    case 'usb':
      return 'U';
    default:
      return 'W';
  }
}

function labelNumber(label: string | undefined, prefix: string): number {
  const m = label ? new RegExp(`^${prefix}-(\\d+)$`).exec(label) : null;
  return m ? Number(m[1]) : 0;
}

export function nextCableLabel(connections: Connection[], prefix: string): string {
  const max = connections.reduce((acc, c) => Math.max(acc, labelNumber(c.label, prefix)), 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

export function connectionPrefix(devices: Device[], c: Pick<Connection, 'from' | 'cable_type'>): string {
  const signal = devices.find((d) => d.id === c.from.device)?.ports.find((p) => p.id === c.from.port)?.signal_type;
  return cablePrefix(signal, c.cable_type);
}

/** Проставляет метки кабелям из старых проектов (у кого их нет), не трогая существующие. */
export function withCableLabels(devices: Device[], connections: Connection[]): Connection[] {
  if (connections.every((c) => c.label)) return connections;
  const result: Connection[] = [];
  for (const c of connections) {
    if (c.label) {
      result.push(c);
      continue;
    }
    const label = nextCableLabel([...connections, ...result], connectionPrefix(devices, c));
    result.push({ ...c, label });
  }
  return result;
}
