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
  computer: 'PC',
  document_camera: 'DOC',
  extender: 'EXT',
  converter: 'CNV',
  video_bar: 'VB',
  vc_codec: 'VC',
  lighting_console: 'LC',
  light_fixture: 'LT',
  dmx_splitter: 'SPL',
  encoder: 'ENC',
  decoder: 'DEC',
  video_recorder: 'REC',
  network_switch: 'NSW',
  controller: 'CTRL',
  wireless_ap: 'AP',
  touch_panel: 'TP',
};

export function tagPrefix(type: string): string {
  return TAG_PREFIX[type] ?? 'DEV';
}

function tagNumber(tag: string | undefined, prefix: string): number {
  const m = tag ? new RegExp(`^${prefix}-(\\d+)$`).exec(tag) : null;
  return m ? Number(m[1]) : 0;
}

/**
 * Следующее свободное обозначение для типа: номер после максимального,
 * поэтому удаление или перестановка устройств не перенумеровывает остальные.
 */
export function nextDeviceTag(devices: Device[], type: string): string {
  const prefix = tagPrefix(type);
  const max = devices.reduce((acc, d) => Math.max(acc, tagNumber(d.tag, prefix)), 0);
  return `${prefix}-${String(max + 1).padStart(2, '0')}`;
}

/** Проставляет обозначения устройствам без них (старые проекты, примеры), не трогая существующие. */
export function withDeviceTags(devices: Device[]): Device[] {
  if (devices.every((d) => d.tag)) return devices;
  const result: Device[] = [];
  for (const d of devices) {
    if (d.tag) {
      result.push(d);
      continue;
    }
    result.push({ ...d, tag: nextDeviceTag([...devices, ...result], d.type) });
  }
  return result;
}

/** Обозначения устройств (MIC-01, AMP-02) для схемы, спецификации и кабельного журнала. */
export function deviceTags(devices: Device[]): Record<string, string> {
  const withTags = withDeviceTags(devices);
  return Object.fromEntries(withTags.map((d) => [d.id, d.tag as string]));
}
