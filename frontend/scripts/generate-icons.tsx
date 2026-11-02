/**
 * Генерирует src/components/deviceIcons.ts — векторные пиктограммы устройств
 * (данные SVG-путей из Material Icons, Apache 2.0) для холста Konva и библиотеки.
 *
 *   npm run icons:generate
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SvgIconComponent } from '@mui/icons-material';
import AltRoute from '@mui/icons-material/AltRoute';
import AspectRatio from '@mui/icons-material/AspectRatio';
import Cable from '@mui/icons-material/Cable';
import DeveloperBoard from '@mui/icons-material/DeveloperBoard';
import ElectricBolt from '@mui/icons-material/ElectricBolt';
import FiberSmartRecord from '@mui/icons-material/FiberSmartRecord';
import Input from '@mui/icons-material/Input';
import Lan from '@mui/icons-material/Lan';
import Memory from '@mui/icons-material/Memory';
import Mic from '@mui/icons-material/Mic';
import Output from '@mui/icons-material/Output';
import PlayCircle from '@mui/icons-material/PlayCircle';
import Sensors from '@mui/icons-material/Sensors';
import SettingsInputAntenna from '@mui/icons-material/SettingsInputAntenna';
import SettingsInputComponent from '@mui/icons-material/SettingsInputComponent';
import Speaker from '@mui/icons-material/Speaker';
import SurroundSound from '@mui/icons-material/SurroundSound';
import TabletMac from '@mui/icons-material/TabletMac';
import Theaters from '@mui/icons-material/Theaters';
import Tune from '@mui/icons-material/Tune';
import Tv from '@mui/icons-material/Tv';
import Videocam from '@mui/icons-material/Videocam';
import Laptop from '@mui/icons-material/Laptop';
import DocumentScanner from '@mui/icons-material/DocumentScanner';
import SettingsEthernet from '@mui/icons-material/SettingsEthernet';
import SwapHoriz from '@mui/icons-material/SwapHoriz';
import VideoCameraFront from '@mui/icons-material/VideoCameraFront';
import VideoCall from '@mui/icons-material/VideoCall';
import Dashboard from '@mui/icons-material/Dashboard';
import Highlight from '@mui/icons-material/Highlight';
import CallSplit from '@mui/icons-material/CallSplit';
import Wifi from '@mui/icons-material/Wifi';

const ICONS: Record<string, SvgIconComponent> = {
  microphone: Mic,
  array_microphone: Sensors,
  wireless_mic: SettingsInputAntenna,
  mixer: Tune,
  amplifier: ElectricBolt,
  speaker: Speaker,
  subwoofer: SurroundSound,
  di_box: Cable,
  audio_interface: SettingsInputComponent,
  dsp: Memory,
  camera: Videocam,
  display: Tv,
  projector: Theaters,
  switcher: AltRoute,
  scaler: AspectRatio,
  media_player: PlayCircle,
  computer: Laptop,
  document_camera: DocumentScanner,
  extender: SettingsEthernet,
  converter: SwapHoriz,
  video_bar: VideoCameraFront,
  vc_codec: VideoCall,
  lighting_console: Dashboard,
  light_fixture: Highlight,
  dmx_splitter: CallSplit,
  encoder: Output,
  decoder: Input,
  video_recorder: FiberSmartRecord,
  network_switch: Lan,
  controller: DeveloperBoard,
  wireless_ap: Wifi,
  touch_panel: TabletMac,
};
const DEFAULT_ICON = SettingsInputComponent;

/** CommonJS-модуль иконки в Node отдаёт компонент в .default — разворачиваем. */
function unwrap(Icon: SvgIconComponent): SvgIconComponent {
  return (Icon as unknown as { default?: SvgIconComponent }).default ?? Icon;
}

/** Все фигуры иконки одной строкой SVG-пути (окружности переводятся в дуги). */
function pathData(Raw: SvgIconComponent): string {
  const Icon = unwrap(Raw);
  const markup = renderToStaticMarkup(<Icon />);
  const parts: string[] = [];
  for (const m of markup.matchAll(/<(path|circle)\b([^>]*)>/g)) {
    const attr = (name: string) => new RegExp(`\\b${name}="([^"]+)"`).exec(m[2])?.[1];
    if (m[1] === 'path') {
      const d = attr('d');
      if (d) parts.push(d);
    } else {
      const [cx, cy, r] = ['cx', 'cy', 'r'].map((a) => Number(attr(a)));
      parts.push(`M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`);
    }
  }
  if (/<(rect|ellipse|polygon|g)\b/.test(markup)) throw new Error(`Неподдерживаемая фигура в иконке: ${markup}`);
  if (parts.length === 0) throw new Error('Пустая иконка');
  return parts.join(' ');
}

const entries = Object.entries(ICONS)
  .map(([type, Icon]) => `  ${type}: '${pathData(Icon)}',`)
  .join('\n');

const out = `// Сгенерировано scripts/generate-icons.tsx (npm run icons:generate) — не править вручную.
// Пиктограммы — SVG-пути Material Icons (Apache License 2.0), область 24×24.

export const ICON_VIEWBOX = 24;

const DEVICE_ICON_PATHS: Record<string, string> = {
${entries}
};

const DEFAULT_ICON_PATH = '${pathData(DEFAULT_ICON)}';

export function deviceIconPath(type: string): string {
  return DEVICE_ICON_PATHS[type] ?? DEFAULT_ICON_PATH;
}
`;

const target = join(dirname(fileURLToPath(import.meta.url)), '../src/components/deviceIcons.ts');
writeFileSync(target, out);
console.log(`written ${target}`);
