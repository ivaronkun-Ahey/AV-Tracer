export const SIGNAL_TYPES = [
  'analog_audio',
  'digital_audio',
  'video',
  'hdmi',
  'sdi',
  'hdbaset',
  'network',
  'control',
  'usb',
  /** Трансляционная линия 70/100 В (громкоговорители с трансформаторами). */
  'line_100v',
  /** DMX512 — управление светом (пульт → приборы по цепочке). */
  'dmx',
] as const;
/** terminal — клеммы трансляционной линии (винтовые или Phoenix). */
export const CABLE_TYPES = ['xlr', 'trs', 'speakon', 'hdmi', 'sdi', 'cat6', 'rca', 'bnc', 'usb', 'terminal'] as const;
export const PORT_DIRECTIONS = ['input', 'output', 'bidirectional'] as const;
export const DEVICE_CATEGORIES = ['audio', 'video', 'network', 'control'] as const;
/**
 * Как сигнал проходит через устройство: all — с любого входа на все выходы
 * (микшер, DSP); channel — вход на выход того же канала (усилитель L→L);
 * select — на выходы идёт только выбранный вход (презентационный коммутатор);
 * matrix — по таблице коммутации вход→выход (матрица).
 */
export const ROUTING_MODES = ['all', 'channel', 'select', 'matrix'] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];
export type CableType = (typeof CABLE_TYPES)[number];
export type PortDirection = (typeof PORT_DIRECTIONS)[number];
export type DeviceCategory = (typeof DEVICE_CATEGORIES)[number];
export type RoutingMode = (typeof ROUTING_MODES)[number];

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

/** Помещение (зона) проекта: на холсте — рамка вокруг своих устройств. */
/** Размеры помещения в плане, м. */
export interface RoomSize {
  width: number;
  length: number;
}

export interface Room {
  id: string;
  name: string;
  /** Цвет рамки, #rrggbb. */
  color: string;
  /** Размеры для плана помещения. */
  size?: RoomSize;
}

/** Место устройства на плане своего помещения: от левого верхнего угла, м; направление, °. */
export interface PlanPlace {
  x: number;
  y: number;
  rotation?: number;
}

/** Шкаф или открытая стойка 19″. */
export interface Rack {
  id: string;
  name: string;
  /** Высота в юнитах (U). */
  units: number;
  /** Помещение, в котором стоит шкаф. */
  room?: string;
}

/** Место устройства в шкафу: нижний занятый юнит (юниты нумеруются снизу, с 1). */
export interface RackPlace {
  rack: string;
  u: number;
}

export interface Device {
  id: string;
  /** Позиционное обозначение (MIC-01): постоянное, не меняется при удалении других устройств. */
  tag?: string;
  /** Помещение, в котором стоит устройство (id из списка помещений проекта). */
  room?: string;
  /** Место в шкафу 19″ (для устройств с высотой specs.rack_units). */
  rack?: RackPlace;
  /** Место на плане помещения (помещение — device.room). */
  plan?: PlanPlace;
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
  routing?: RoutingMode;
  /** Откуда и когда сверены данные с производителем; нет поля — данные не сверены. */
  source?: { url: string; verified: string; notes?: string };
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
  /** Порт, через который сигнал вошёл в каждое устройство пути (у источника — null). */
  entry_ports?: (string | null)[];
  /** Пояснение: например, вход не выбран на коммутаторе. */
  note?: string;
  status: 'ok' | 'warning' | 'error';
}

/**
 * Исправление, которое приложение может применить само (кнопка «Исправить»):
 * изменить параметр устройства или отключить кабель. Это обычная правка —
 * отменяется через Ctrl+Z.
 */
export type SimFix =
  | { kind: 'set_property'; label: string; device: string; property: string; value: PropValue }
  | { kind: 'remove_connection'; label: string; connection: string };

export interface SimIssue {
  type: string;
  device: string;
  /** Соединение, к которому относится проблема (если она про кабель). */
  connection?: string;
  message: string;
  severity?: 'low' | 'medium' | 'high';
  fix?: SimFix;
}

export interface SimulationResult {
  valid: boolean;
  signal_flows: SignalFlow[];
  warnings: SimIssue[];
  errors: SimIssue[];
}

/** Данные для основной надписи чертежей (штампа) — хранятся в проекте. */
export interface ProjectMeta {
  /** Обозначение документа (шифр), например «2026-01-СС». */
  code?: string;
  /** Наименование объекта (предприятия, комплекса). */
  object?: string;
  /** Наименование здания или сооружения. */
  building?: string;
  /** Стадия: П — проектная документация, Р — рабочая. */
  stage?: string;
  /** Организация-разработчик. */
  organization?: string;
  developer?: string;
  checker?: string;
  normControl?: string;
  chiefEngineer?: string;
}

/** Содержимое проекта: то, что сохраняется в файл и автосейв и попадает в историю отмены. */
export interface ProjectDoc {
  devices: Device[];
  connections: Connection[];
  rooms: Room[];
  /** Шкафы 19″; в старых проектах и учебных схемах их нет. */
  racks?: Rack[];
  meta?: ProjectMeta;
}
