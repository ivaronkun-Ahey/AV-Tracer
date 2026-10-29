import { CableType, SignalType } from '../types/device.types';

/** Человеко-читаемые русские названия для типов устройств. */
export const DEVICE_TYPE_LABELS: Record<string, string> = {
  microphone: 'Микрофон',
  array_microphone: 'Микрофонный массив',
  wireless_mic: 'Радиосистема (микрофон)',
  mixer: 'Микшер',
  amplifier: 'Усилитель',
  speaker: 'Акустическая система',
  subwoofer: 'Сабвуфер',
  di_box: 'DI-бокс',
  audio_interface: 'Аудиоинтерфейс',
  camera: 'Камера',
  display: 'Дисплей',
  projector: 'Проектор',
  switcher: 'Видеокоммутатор',
  scaler: 'Масштабатор',
  media_player: 'Медиаплеер',
  computer: 'Компьютер',
  document_camera: 'Документ-камера',
  extender: 'Удлинитель',
  converter: 'Конвертер',
  video_bar: 'Видеобар (ВКС)',
  vc_codec: 'Кодек ВКС',
  lighting_console: 'Пульт управления светом',
  light_fixture: 'Световой прибор',
  dmx_splitter: 'DMX-сплиттер',
  encoder: 'AV-over-IP кодер',
  decoder: 'AV-over-IP декодер',
  video_recorder: 'Видеорекордер',
  network_switch: 'Сетевой коммутатор',
  controller: 'Контроллер',
  dsp: 'Аудиопроцессор (DSP)',
  wireless_ap: 'Точка доступа Wi-Fi',
  touch_panel: 'Сенсорная панель',
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
  Subwoofers: 'Сабвуферы',
  'Wireless Systems': 'Радиосистемы',
  'DI Boxes & Interfaces': 'DI-боксы и интерфейсы',
  Cameras: 'Камеры',
  'Displays & Projectors': 'Дисплеи и проекторы',
  'Switchers & Processors': 'Коммутаторы и процессоры',
  'Media Players': 'Медиаплееры',
  'Computers & Document Cameras': 'Компьютеры и документ-камеры',
  'Extenders & Converters': 'Удлинители и конвертеры',
  Conferencing: 'Видеоконференцсвязь',
  'AV-over-IP': 'AV-over-IP (кодеры/декодеры)',
  'Recording & Streaming': 'Запись и стриминг',
  'Network Switches': 'Сетевые коммутаторы',
  'Audio Network': 'Сетевое аудио (Dante)',
  'Control Systems': 'Системы управления',
  'Wireless & Access Points': 'Точки доступа Wi-Fi',
  'Touch Panels': 'Панели управления',
  'Public Address 100V': 'Трансляционная система 100 В',
  'Lighting (DMX)': 'Свет (DMX)',
};

export const SIGNAL_LABELS: Record<SignalType, string> = {
  line_100v: 'Трансляционная линия 100 В',
  dmx: 'DMX512 (управление светом)',
  analog_audio: 'Аналоговое аудио',
  digital_audio: 'Цифровое аудио (Dante)',
  video: 'Видео',
  hdmi: 'HDMI',
  sdi: 'SDI',
  hdbaset: 'HDBaseT',
  network: 'Сеть',
  control: 'Управление',
  usb: 'USB',
};

export const DIRECTION_LABELS: Record<string, string> = {
  input: 'вход',
  output: 'выход',
  bidirectional: 'вход/выход',
};

/** Подпись параметра устройства в панели свойств. */
export const PROPERTY_LABELS: Record<string, string> = {
  gain: 'Усиление (дБ)',
  input_gain: 'Усиление входа (дБ)',
  master_gain: 'Общее усиление (дБ)',
  phantom_power: 'Фантомное питание +48V',
  sensitivity: 'Чувствительность (дБВ/Па)',
  channels: 'Каналов',
  power_watts: 'Мощность (Вт)',
  impedance_ohms: 'Сопротивление (Ω)',
  active: 'Активная (со встроенным усилителем)',
  resolution: 'Разрешение',
  output_level: 'Уровень выхода (дБu)',
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
  max_resolution: 'Макс. разрешение входа',
  selected_input: 'Выбранный вход (номер)',
  routes: 'Коммутация матрицы (вход>выход, через запятую)',
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
  min_impedance_ohms: 'Мин. сопротивление (Ω)',
  // Радиосистемы
  frequency_band: 'Диапазон частот',
  battery_hours: 'Время работы (ч)',
  diversity: 'Diversity-приём',
  // Аудиоинтерфейсы
  sample_rate: 'Частота дискретизации (кГц)',
  bit_depth: 'Разрядность (бит)',
  // Сабвуферы / пассивные АС
  passive: 'Пассивный',
  crossover_hz: 'Частота кроссовера (Гц)',
  power_handling_watts: 'Допустимая мощность (Вт)',
  // Трансляционная линия 70/100 В
  line_voltage: 'Напряжение линии (В)',
  tap_watts: 'Отвод трансформатора (Вт)',
  // Свет (DMX)
  dmx_address: 'DMX-адрес (первый канал)',
  dmx_channels: 'Каналов DMX (режим)',
  dmx_terminator: 'Терминатор DMX на выходе',
  universes: 'Вселенных DMX',
  max_spl_db: 'Макс. SPL (дБ)',
  // Медиаплееры / запись
  storage_gb: 'Накопитель (ГБ)',
  hdr: 'HDR',
  format: 'Формат записи',
  loop_out: 'Сквозной выход',
  // AV-over-IP / стриминг
  codec: 'Кодек',
  bitrate_mbps: 'Битрейт (Мбит/с)',
  latency_ms: 'Задержка (мс)',
  // Сеть и управление
  screen_size_in: 'Диагональ экрана (")',
  wifi_standard: 'Стандарт Wi-Fi',
  max_clients: 'Макс. клиентов',
  requires_poe: 'Питание PoE',
};

export function deviceTypeLabel(type: string): string {
  return DEVICE_TYPE_LABELS[type] || type;
}

export function propertyLabel(key: string): string {
  return PROPERTY_LABELS[key] || key;
}

/** Короткая подпись для порта на холсте/в списке. */
export function portLabel(port: { id: string; type: CableType; signal_type: SignalType; label?: string }): string {
  if (port.label) return port.label;
  if (port.id) {
    // Превращаем "xlr_in_1" -> "XLR IN 1"
    return port.id.replace(/_/g, ' ').toUpperCase();
  }
  return port.type.toUpperCase();
}
