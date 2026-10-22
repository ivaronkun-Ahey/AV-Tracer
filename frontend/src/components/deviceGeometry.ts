import { Device, Port } from '../types/device.types';

/** Минимальная ширина узла; с большим числом портов узел становится шире. */
export const NODE_W = 140;
export const NODE_H = 92;
export const PORT_R = 7;
/** Шаг между центрами портов, чтобы кружки не налезали друг на друга. */
export const PORT_GAP = 20;

export function inputPorts(device: Device): Port[] {
  return device.ports.filter((p) => p.direction === 'input' || p.direction === 'bidirectional');
}

export function outputPorts(device: Device): Port[] {
  return device.ports.filter((p) => p.direction === 'output' || p.direction === 'bidirectional');
}

export function nodeWidth(device: Device): number {
  const most = Math.max(inputPorts(device).length, outputPorts(device).length);
  return Math.max(NODE_W, (most + 1) * PORT_GAP);
}

/** Локальная X-координата порта внутри узла (относительно левого верхнего угла). */
export function portLocalX(width: number, count: number, index: number): number {
  return (width / (count + 1)) * (index + 1);
}

/** Абсолютная позиция выходного порта (нижняя кромка узла). */
export function outputPortPos(device: Device, portId: string): { x: number; y: number } | null {
  const outs = outputPorts(device);
  const idx = outs.findIndex((p) => p.id === portId);
  if (idx === -1) return null;
  return {
    x: device.position.x + portLocalX(nodeWidth(device), outs.length, idx),
    y: device.position.y + NODE_H,
  };
}

/** Абсолютная позиция входного порта (верхняя кромка узла). */
export function inputPortPos(device: Device, portId: string): { x: number; y: number } | null {
  const ins = inputPorts(device);
  const idx = ins.findIndex((p) => p.id === portId);
  if (idx === -1) return null;
  return {
    x: device.position.x + portLocalX(nodeWidth(device), ins.length, idx),
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
  usb: '#E91E63',
};

export function signalColor(signalType: string): string {
  return SIGNAL_COLORS[signalType] || '#0066CC';
}

// Сигналы, которые физически передаются по сети/IP (один кабель cat6).
const IP_SIGNALS = new Set(['network', 'digital_audio']);

/** Можно ли соединить два порта по типу сигнала. */
export function signalsCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  return IP_SIGNALS.has(a) && IP_SIGNALS.has(b);
}

const DEVICE_EMOJI: Record<string, string> = {
  microphone: '🎤',
  array_microphone: '🎙️',
  wireless_mic: '📡',
  mixer: '🎛️',
  amplifier: '📢',
  speaker: '🔊',
  subwoofer: '🔉',
  di_box: '🔌',
  audio_interface: '🎚️',
  camera: '📹',
  display: '🖥️',
  projector: '📽️',
  switcher: '🔀',
  scaler: '⚡',
  media_player: '▶️',
  encoder: '📤',
  decoder: '📥',
  video_recorder: '📼',
  network_switch: '🌐',
  controller: '🎮',
  dsp: '💠',
  wireless_ap: '📶',
  touch_panel: '📱',
};

export function deviceEmoji(type: string): string {
  return DEVICE_EMOJI[type] || '📦';
}
