import { Device } from '../types/device.types';

/** Префиксы позиционных обозначений устройств на схеме и в спецификации. */
const TAG_PREFIX: Record<string, string> = {
  microphone: 'MIC',
  array_microphone: 'MIC',
  wireless_mic: 'RX',
  mixer: 'MIX',
  amplifier: 'AMP',
  speaker: 'SPK',
  subwoofer: 'SUB',
  di_box: 'DI',
  audio_interface: 'AIF',
  dsp: 'DSP',
  camera: 'CAM',
  display: 'DISP',
  projector: 'PRJ',
  switcher: 'VSW',
  scaler: 'SCL',
  media_player: 'MP',
  encoder: 'ENC',
  decoder: 'DEC',
  video_recorder: 'REC',
  network_switch: 'NSW',
  controller: 'CTRL',
  wireless_ap: 'AP',
  touch_panel: 'TP',
};

/** Обозначения вида MIC-01, AMP-02 — по порядку добавления устройств. */
export function deviceTags(devices: Device[]): Record<string, string> {
  const counters: Record<string, number> = {};
  const tags: Record<string, string> = {};
  for (const d of devices) {
    const prefix = TAG_PREFIX[d.type] ?? 'DEV';
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    tags[d.id] = `${prefix}-${String(counters[prefix]).padStart(2, '0')}`;
  }
  return tags;
}
