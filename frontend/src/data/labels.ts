import { CableType, SignalType } from '../types/device.types';

/** Человеко-читаемые русские названия для типов устройств. */
export const DEVICE_TYPE_LABELS: Record<string, string> = {
  microphone: 'Микрофон',
  array_microphone: 'Микрофонный массив',
  mixer: 'Микшер',
  amplifier: 'Усилитель',
  speaker: 'Акустическая система',
  camera: 'Камера',
  display: 'Дисплей',
  projector: 'Проектор',
  switcher: 'Видеокоммутатор',
  scaler: 'Масштабатор',
  network_switch: 'Сетевой коммутатор',
  controller: 'Контроллер',
  dsp: 'Аудиопроцессор (DSP)',
};

export const CATEGORY_LABELS: Record<string, string> = {
  audio: 'Аудио',
  video: 'Видео',
  network: 'Сеть и управление',
  control: 'Управление',
};

export const SUBCATEGORY_LABELS: Record<string, string> = {
  Microphones: 'Микрофоны',
  'Mixers & Consoles': 'Микшеры и пульты',
  Amplifiers: 'Усилители',
  Speakers: 'Акустические системы',
  Cameras: 'Камеры',
  'Displays & Projectors': 'Дисплеи и проекторы',
  'Switchers & Processors': 'Коммутаторы и процессоры',
  'Network Switches': 'Сетевые коммутаторы',
  'Audio Network': 'Сетевое аудио (Dante)',
  'Control Systems': 'Системы управления',
};

export const SIGNAL_LABELS: Record<SignalType, string> = {
  analog_audio: 'Аналоговое аудио',
  digital_audio: 'Цифровое аудио (Dante)',
  video: 'Видео',
  hdmi: 'HDMI',
  sdi: 'SDI',
  network: 'Сеть',
  control: 'Управление',
};

export const DIRECTION_LABELS: Record<string, string> = {
  input: 'вход',
  output: 'выход',
  bidirectional: 'вход/выход',
};

/** Подпись параметра устройства в панели свойств. */
export const PROPERTY_LABELS: Record<string, string> = {
  gain: 'Усиление (дБ)',
  master_gain: 'Общее усиление (дБ)',
  phantom_power: 'Фантомное питание +48V',
  sensitivity: 'Чувствительность (дБ)',
  channels: 'Каналов',
  power_watts: 'Мощность (Вт)',
  impedance_ohms: 'Сопротивление (Ω)',
  active: 'Активная (со встроенным усилителем)',
  resolution: 'Разрешение',
  fps: 'Частота кадров',
  ptz: 'PTZ (поворот/наклон/зум)',
  zoom: 'Кратность зума',
  size_inches: 'Диагональ (дюймы)',
  brightness_nits: 'Яркость (нит)',
  lumens: 'Яркость (люмен)',
  throw_ratio: 'Проекционное отношение',
  inputs: 'Входов',
  outputs: 'Выходов',
  switching_type: 'Тип коммутации',
  streaming: 'Стриминг',
  scaling: 'Масштабирование',
  resolution_out: 'Выходное разрешение',
  ports: 'Портов',
  poe: 'PoE (питание по сети)',
  managed: 'Управляемый',
  vlan: 'Поддержка VLAN',
  dante: 'Dante',
  coverage_angle: 'Угол охвата (°)',
  qsys: 'Q-SYS',
  processing: 'Обработка',
  control: 'Управление',
  programming: 'Среда программирования',
  mode: 'Режим',
  effects: 'Эффекты',
  pattern: 'Диаграмма направленности',
  pad: 'Аттенюатор (дБ)',
  power: 'Мощность (Вт)',
  impedance: 'Сопротивление (Ω)',
};

export function deviceTypeLabel(type: string): string {
  return DEVICE_TYPE_LABELS[type] || type;
}

export function propertyLabel(key: string): string {
  return PROPERTY_LABELS[key] || key;
}

/** Короткая подпись для порта на холсте/в списке. */
export function portLabel(port: { id: string; type: CableType; signal_type: SignalType }): string {
  if (port.id) {
    // Превращаем "xlr_in_1" -> "XLR IN 1"
    return port.id.replace(/_/g, ' ').toUpperCase();
  }
  return port.type.toUpperCase();
}
