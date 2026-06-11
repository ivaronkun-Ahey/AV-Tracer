import { Device, Port } from '../types/device.types';

export const NODE_W = 140;
export const NODE_H = 92;
export const PORT_R = 7;

export function inputPorts(device: Device): Port[] {
  return device.ports.filter((p) => p.direction === 'input' || p.direction === 'bidirectional');
}

export function outputPorts(device: Device): Port[] {
  return device.ports.filter((p) => p.direction === 'output' || p.direction === 'bidirectional');
}

/** Локальная X-координата порта внутри узла (относительно левого верхнего угла). */
export function portLocalX(count: number, index: number): number {
  return (NODE_W / (count + 1)) * (index + 1);
}

/** Абсолютная позиция выходного порта (нижняя кромка узла). */
export function outputPortPos(device: Device, portId: string): { x: number; y: number } | null {
  const outs = outputPorts(device);
  const idx = outs.findIndex((p) => p.id === portId);
  if (idx === -1) return null;
  return {
    x: device.position.x + portLocalX(outs.length, idx),
    y: device.position.y + NODE_H,
  };
}

/** Абсолютная позиция входного порта (верхняя кромка узла). */
export function inputPortPos(device: Device, portId: string): { x: number; y: number } | null {
  const ins = inputPorts(device);
  const idx = ins.findIndex((p) => p.id === portId);
  if (idx === -1) return null;
  return {
    x: device.position.x + portLocalX(ins.length, idx),
    y: device.position.y,
  };
}

const SIGNAL_COLORS: Record<string, string> = {
  analog_audio: '#FF6B00',
  digital_audio: '#0066CC',
  video: '#00B8D4',
  hdmi: '#00B8D4',
  sdi: '#00C8FF',
  network: '#00C853',
  control: '#9C27B0',
};

export function signalColor(signalType: string): string {
  return SIGNAL_COLORS[signalType] || '#0066CC';
}

const DEVICE_EMOJI: Record<string, string> = {
  microphone: '🎤',
  array_microphone: '🎙️',
  mixer: '🎛️',
  amplifier: '📢',
  speaker: '🔊',
  camera: '📹',
  display: '🖥️',
  projector: '📽️',
  switcher: '🔀',
  scaler: '⚡',
  network_switch: '🌐',
  controller: '🎮',
  dsp: '💠',
};

export function deviceEmoji(type: string): string {
  return DEVICE_EMOJI[type] || '📦';
}
