export const SIGNAL_TYPES = ['analog_audio', 'digital_audio', 'video', 'hdmi', 'sdi', 'network', 'control', 'usb'] as const;
export const CABLE_TYPES = ['xlr', 'trs', 'speakon', 'hdmi', 'sdi', 'cat6', 'rca', 'bnc', 'usb'] as const;
export const PORT_DIRECTIONS = ['input', 'output', 'bidirectional'] as const;
export const DEVICE_CATEGORIES = ['audio', 'video', 'network', 'control'] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];
export type CableType = (typeof CABLE_TYPES)[number];
export type PortDirection = (typeof PORT_DIRECTIONS)[number];
export type DeviceCategory = (typeof DEVICE_CATEGORIES)[number];

/** Значение параметра устройства: число, флаг, строка или список. */
export type PropValue = string | number | boolean | null | Array<string | number>;
export type PropMap = Record<string, PropValue>;

export interface Port {
  id: string;
  type: CableType;
  direction: PortDirection;
  signal_type: SignalType;
  label?: string;
}

export interface Device {
  id: string;
  type: string;
  category: DeviceCategory;
  manufacturer: string;
  model: string;
  full_name: string;
  position: { x: number; y: number };
  ports: Port[];
  properties: PropMap;
  specs?: PropMap;
  icon_url?: string;
  image_url?: string;
}

/** Карточка оборудования в библиотеке (шаблон, из которого создаётся Device). */
export interface EquipmentTemplate {
  _id: string;
  type: string;
  category: DeviceCategory;
  manufacturer: string;
  model: string;
  full_name: string;
  ports: Port[];
  default_properties: PropMap;
  specs?: PropMap;
}

export interface Connection {
  id: string;
  from: {
    device: string;
    port: string;
  };
  to: {
    device: string;
    port: string;
  };
  cable_type: CableType;
  cable_length: number;
  /** Маркировка кабеля для схемы и кабельного журнала, например A-001. */
  label?: string;
}

export interface Project {
  id: string;
  name: string;
  devices: Device[];
  connections: Connection[];
  created_at: string;
  updated_at: string;
}

/** Результаты работы движка симуляции (frontend/src/sim/engine.ts). */
export interface SignalFlow {
  type: 'audio' | 'video';
  source: string;
  path: string[];
  /** Аудио: линейный уровень (дБu) в точке контроля level_at. */
  final_level_db?: number;
  /** Аудио: устройство, где измерен уровень (вход усилителя/активной АС или конец тракта). */
  level_at?: string;
  resolution?: string;
  status: 'ok' | 'warning' | 'error';
}

export interface SimIssue {
  type: string;
  device: string;
  /** Соединение, к которому относится проблема (если она про кабель). */
  connection?: string;
  message: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface SimulationResult {
  valid: boolean;
  signal_flows: SignalFlow[];
  warnings: SimIssue[];
  errors: SimIssue[];
}
