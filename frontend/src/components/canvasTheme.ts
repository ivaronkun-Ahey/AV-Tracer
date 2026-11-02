import { createContext } from 'react';

/** Цвета холста. Тёмная тема — для работы, светлая — для печати и экспорта. */
export interface CanvasPalette {
  background: string;
  nodeFill: string;
  nodeStroke: string;
  headerFill: string;
  title: string;
  subtitle: string;
  tag: string;
  portLabel: string;
  portStroke: string;
  cableLabelFill: string;
  cableLabelText: string;
  selection: string;
  connecting: string;
  error: string;
  warning: string;
}

export const DARK_PALETTE: CanvasPalette = {
  background: '#11161f',
  nodeFill: '#1c232e',
  nodeStroke: '#3d4654',
  headerFill: '#252e3b',
  title: '#ffffff',
  subtitle: '#8b95a5',
  tag: '#ffc65c',
  portLabel: '#c9d1d9',
  portStroke: '#ffffff',
  cableLabelFill: '#0d1117',
  cableLabelText: '#c9d1d9',
  selection: '#3DDC84',
  connecting: '#FFC107',
  error: '#F44336',
  warning: '#FF9800',
};

export const LIGHT_PALETTE: CanvasPalette = {
  background: '#ffffff',
  nodeFill: '#ffffff',
  nodeStroke: '#2b3440',
  headerFill: '#eef1f5',
  title: '#111827',
  subtitle: '#4b5563',
  tag: '#9a5b00',
  portLabel: '#1f2937',
  portStroke: '#2b3440',
  cableLabelFill: '#ffffff',
  cableLabelText: '#1f2937',
  selection: '#2e7d32',
  connecting: '#b58100',
  error: '#c62828',
  warning: '#e65100',
};

export interface CanvasRender {
  palette: CanvasPalette;
  /** false — статичная отрисовка для экспорта: без выделений, подсказок и обработчиков. */
  interactive: boolean;
  showCableLabels: boolean;
}

export const CanvasRenderContext = createContext<CanvasRender>({
  palette: DARK_PALETTE,
  interactive: true,
  showCableLabels: true,
});
