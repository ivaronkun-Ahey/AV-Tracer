import {
  CableType,
  Device,
  DeviceCategory,
  EquipmentTemplate,
  Port,
  PortDirection,
  SignalType,
} from '../types/device.types';

// ---------------------------------------------------------------------------
// Конструкторы портов. Количество портов соответствует реальному оборудованию
// (упрощённо): 16 входов SQ-5, 32 входа X32, 24 порта коммутатора и т. д.
// ---------------------------------------------------------------------------

const port = (id: string, type: CableType, direction: PortDirection, signal_type: SignalType): Port => ({
  id,
  type,
  direction,
  signal_type,
});

/** Серия однотипных портов: series('xlr_in', 3, …) → xlr_in_1, xlr_in_2, xlr_in_3. */
const series = (
  prefix: string,
  count: number,
  type: CableType,
  direction: PortDirection,
  signal: SignalType,
  start = 1
): Port[] => Array.from({ length: count }, (_, i) => port(`${prefix}_${start + i}`, type, direction, signal));

const xlrIn = (id = 'xlr_in') => port(id, 'xlr', 'input', 'analog_audio');
const xlrOut = (id = 'xlr_out') => port(id, 'xlr', 'output', 'analog_audio');
const xlrIns = (n: number, start = 1) => series('xlr_in', n, 'xlr', 'input', 'analog_audio', start);
const xlrOuts = (n: number, start = 1) => series('xlr_out', n, 'xlr', 'output', 'analog_audio', start);
const trsIn = (id = 'trs_in') => port(id, 'trs', 'input', 'analog_audio');
const trsOut = (id = 'trs_out') => port(id, 'trs', 'output', 'analog_audio');
const trsIns = (n: number, start = 1) => series('trs_in', n, 'trs', 'input', 'analog_audio', start);
const speakonIn = (id = 'speakon_in') => port(id, 'speakon', 'input', 'analog_audio');
const speakonOut = (id: string) => port(id, 'speakon', 'output', 'analog_audio');
const speakonOuts = (n: number) => series('speakon_out', n, 'speakon', 'output', 'analog_audio');
const hdmiIn = (id = 'hdmi_in') => port(id, 'hdmi', 'input', 'hdmi');
const hdmiOut = (id = 'hdmi_out') => port(id, 'hdmi', 'output', 'hdmi');
const hdmiIns = (n: number, start = 1) => series('hdmi_in', n, 'hdmi', 'input', 'hdmi', start);
const hdmiOuts = (n: number, start = 1) => series('hdmi_out', n, 'hdmi', 'output', 'hdmi', start);
const sdiIn = (id = 'sdi_in') => port(id, 'bnc', 'input', 'sdi');
const sdiOut = (id = 'sdi_out') => port(id, 'bnc', 'output', 'sdi');
const sdiIns = (n: number, start = 1) => series('sdi_in', n, 'bnc', 'input', 'sdi', start);
const sdiOuts = (n: number, start = 1) => series('sdi_out', n, 'bnc', 'output', 'sdi', start);
const danteIn = (id = 'dante_in') => port(id, 'cat6', 'input', 'digital_audio');
const danteOut = (id = 'dante_out') => port(id, 'cat6', 'output', 'digital_audio');
const ipIn = (id = 'network_in') => port(id, 'cat6', 'input', 'network');
const ipOut = (id = 'network_out') => port(id, 'cat6', 'output', 'network');
/** Ethernet-порт (LAN): двунаправленный, для управления и сетевого трафика. */
const lan = (id = 'eth') => port(id, 'cat6', 'bidirectional', 'network');
const lans = (n: number) => series('eth', n, 'cat6', 'bidirectional', 'network');
const usbOut = (id = 'usb_out') => port(id, 'usb', 'output', 'usb');

type Template = Omit<EquipmentTemplate, 'category'>;
const inCategory =
  (category: DeviceCategory) =>
  (t: Template): EquipmentTemplate => ({ ...t, category });
const audio = inCategory('audio');
const video = inCategory('video');
const network = inCategory('network');
const control = inCategory('control');

export interface EquipmentSubcategory {
  name: string;
  items: EquipmentTemplate[];
}

export interface EquipmentCategory {
  category: DeviceCategory;
  name: string;
  icon: string;
  subcategories: EquipmentSubcategory[];
}

// Библиотека профессионального AV-оборудования (60 устройств).
//  - sensitivity у микрофонов — чувствительность, дБВ/Па (уровень при 94 дБ SPL);
//  - input_gain у микшеров/DSP/интерфейсов — усиление предусилителя входа, дБ;
//  - max_resolution у коммутаторов/кодеров — максимальное поддерживаемое разрешение.
export const EQUIPMENT_LIBRARY: EquipmentCategory[] = [
  {
    category: 'audio',
    name: 'Audio Equipment',
    icon: '🎤',
    subcategories: [
      {
        name: 'Microphones',
        items: [
          audio({
            _id: 'shure-sm58',
            type: 'microphone',
            manufacturer: 'Shure',
            model: 'SM58',
            full_name: 'Shure SM58 Dynamic Microphone',
            ports: [xlrOut()],
            default_properties: { phantom_power: false, sensitivity: -54.5 },
            specs: { type: 'dynamic', pattern: 'cardioid', frequency_response: '50Hz-15kHz' },
          }),
          audio({
            _id: 'shure-beta87a',
            type: 'microphone',
            manufacturer: 'Shure',
            model: 'Beta 87A',
            full_name: 'Shure Beta 87A Condenser',
            ports: [xlrOut()],
            default_properties: { phantom_power: true, sensitivity: -52.0 },
            specs: { type: 'condenser', pattern: 'cardioid', requires_phantom: true },
          }),
          audio({
            _id: 'akg-c414',
            type: 'microphone',
            manufacturer: 'AKG',
            model: 'C414 XLII',
            full_name: 'AKG C414 XLII Studio Condenser',
            ports: [xlrOut()],
            default_properties: { phantom_power: true, sensitivity: -32.8, pattern: 'cardioid', pad: 0 },
            specs: { type: 'condenser', patterns: ['omni', 'cardioid', 'figure-8'], requires_phantom: true },
          }),
          audio({
            _id: 'sennheiser-e835',
            type: 'microphone',
            manufacturer: 'Sennheiser',
            model: 'e835',
            full_name: 'Sennheiser e835 Dynamic',
            ports: [xlrOut()],
            default_properties: { phantom_power: false, sensitivity: -51.4 },
            specs: { type: 'dynamic', pattern: 'cardioid' },
          }),
          audio({
            _id: 'shure-sm57',
            type: 'microphone',
            manufacturer: 'Shure',
            model: 'SM57',
            full_name: 'Shure SM57 Dynamic Instrument Microphone',
            ports: [xlrOut()],
            default_properties: { phantom_power: false, sensitivity: -56.0 },
            specs: { type: 'dynamic', pattern: 'cardioid' },
          }),
          audio({
            _id: 'rode-nt1',
            type: 'microphone',
            manufacturer: 'Rode',
            model: 'NT1 5th Gen',
            full_name: 'Rode NT1 5th Gen Condenser (XLR/USB)',
            ports: [xlrOut(), usbOut()],
            default_properties: { phantom_power: true, sensitivity: -29.0 },
            specs: { type: 'condenser', pattern: 'cardioid', requires_phantom: true },
          }),
        ],
      },
      {
        name: 'Mixers & Consoles',
        items: [
          audio({
            _id: 'allen-heath-sq5',
            type: 'mixer',
            manufacturer: 'Allen & Heath',
            model: 'SQ-5',
            full_name: 'Allen & Heath SQ-5 Digital Mixer',
            ports: [...xlrIns(16), xlrOut('xlr_out_l'), xlrOut('xlr_out_r'), ...xlrOuts(10)],
            default_properties: { channels: 16, input_gain: 45, master_gain: 0, phantom_power: true },
          }),
          audio({
            _id: 'yamaha-mg12xu',
            type: 'mixer',
            manufacturer: 'Yamaha',
            model: 'MG12XU',
            full_name: 'Yamaha MG12XU Analog Mixer',
            ports: [...xlrIns(6), ...trsIns(6, 7), xlrOut('xlr_out_l'), xlrOut('xlr_out_r')],
            default_properties: { channels: 12, input_gain: 45, master_gain: 0, effects: true },
          }),
          audio({
            _id: 'behringer-x32',
            type: 'mixer',
            manufacturer: 'Behringer',
            model: 'X32',
            full_name: 'Behringer X32 Digital Mixer',
            ports: [...xlrIns(32), xlrOut('xlr_out_l'), xlrOut('xlr_out_r'), ...xlrOuts(14)],
            default_properties: { channels: 32, input_gain: 45, master_gain: 0, phantom_power: true },
          }),
          audio({
            _id: 'midas-m32',
            type: 'mixer',
            manufacturer: 'Midas',
            model: 'M32',
            full_name: 'Midas M32 Digital Console',
            ports: [...xlrIns(32), xlrOut('xlr_out_l'), xlrOut('xlr_out_r'), ...xlrOuts(14), danteOut()],
            default_properties: { channels: 32, input_gain: 45, master_gain: 0, phantom_power: true, dante: true },
          }),
        ],
      },
      {
        name: 'Amplifiers',
        items: [
          audio({
            _id: 'crown-xls2502',
            type: 'amplifier',
            manufacturer: 'Crown',
            model: 'XLS 2502',
            full_name: 'Crown XLS 2502 Power Amplifier',
            ports: [xlrIn('xlr_in_l'), xlrIn('xlr_in_r'), speakonOut('speakon_out_l'), speakonOut('speakon_out_r')],
            default_properties: { power_watts: 775, gain: 20, mode: 'stereo', min_impedance_ohms: 4 },
          }),
          audio({
            _id: 'qsc-gx5',
            type: 'amplifier',
            manufacturer: 'QSC',
            model: 'GX5',
            full_name: 'QSC GX5 Power Amplifier',
            ports: [xlrIn('xlr_in_l'), xlrIn('xlr_in_r'), speakonOut('speakon_out_l'), speakonOut('speakon_out_r')],
            default_properties: { power_watts: 500, gain: 20, min_impedance_ohms: 4 },
          }),
          audio({
            _id: 'labgruppen-fp10000q',
            type: 'amplifier',
            manufacturer: 'Lab Gruppen',
            model: 'FP 10000Q',
            full_name: 'Lab Gruppen FP 10000Q Power Amplifier',
            ports: [...xlrIns(4), ...speakonOuts(4)],
            default_properties: { power_watts: 2500, gain: 23, min_impedance_ohms: 2, mode: '4-channel' },
          }),
        ],
      },
      {
        name: 'Speakers',
        items: [
          audio({
            _id: 'jbl-prx815w',
            type: 'speaker',
            manufacturer: 'JBL',
            model: 'PRX815W',
            full_name: 'JBL PRX815W Powered Speaker',
            ports: [xlrIn(), xlrOut('xlr_thru')],
            default_properties: { power_watts: 1500, impedance_ohms: 8, active: true },
          }),
          audio({
            _id: 'ev-zlx12p',
            type: 'speaker',
            manufacturer: 'Electro-Voice',
            model: 'ZLX-12P',
            full_name: 'EV ZLX-12P Powered Speaker',
            ports: [xlrIn()],
            default_properties: { power_watts: 1000, impedance_ohms: 8, active: true },
          }),
          audio({
            _id: 'qsc-k12',
            type: 'speaker',
            manufacturer: 'QSC',
            model: 'K12.2',
            full_name: 'QSC K12.2 Active Speaker',
            ports: [xlrIn(), xlrOut('xlr_thru')],
            default_properties: { power_watts: 2000, impedance_ohms: 8, active: true },
          }),
          audio({
            _id: 'yorkville-yx15p',
            type: 'speaker',
            manufacturer: 'Yorkville',
            model: 'YX15P',
            full_name: 'Yorkville YX15P Passive Speaker',
            ports: [speakonIn()],
            default_properties: { impedance_ohms: 8, active: false, power_handling_watts: 400 },
          }),
          audio({
            _id: 'rcf-art745a',
            type: 'speaker',
            manufacturer: 'RCF',
            model: 'ART 745-A',
            full_name: 'RCF ART 745-A MK5 Active Speaker',
            ports: [xlrIn(), xlrOut('xlr_thru')],
            default_properties: { power_watts: 1400, impedance_ohms: 8, active: true, max_spl_db: 134 },
          }),
          audio({
            _id: 'ev-evf1122',
            type: 'speaker',
            manufacturer: 'Electro-Voice',
            model: 'EVF-1122S',
            full_name: 'EV EVF-1122S Passive Install Speaker',
            ports: [speakonIn()],
            default_properties: { impedance_ohms: 8, active: false, power_handling_watts: 600 },
          }),
        ],
      },
      {
        name: 'Subwoofers',
        items: [
          audio({
            _id: 'jbl-prx818xlfw',
            type: 'subwoofer',
            manufacturer: 'JBL',
            model: 'PRX818XLFW',
            full_name: 'JBL PRX818XLFW Powered Subwoofer',
            ports: [xlrIn(), xlrOut('xlr_thru')],
            default_properties: { power_watts: 1500, active: true, crossover_hz: 100, max_spl_db: 135 },
          }),
          audio({
            _id: 'qsc-ks112',
            type: 'subwoofer',
            manufacturer: 'QSC',
            model: 'KS112',
            full_name: 'QSC KS112 Powered Subwoofer',
            ports: [xlrIn(), xlrOut('xlr_thru')],
            default_properties: { power_watts: 2000, active: true, crossover_hz: 80, max_spl_db: 132 },
          }),
        ],
      },
      {
        name: 'Wireless Systems',
        items: [
          audio({
            _id: 'shure-ulxd4',
            type: 'wireless_mic',
            manufacturer: 'Shure',
            model: 'ULXD4',
            full_name: 'Shure ULXD4 Digital Wireless Receiver',
            ports: [xlrOut(), trsOut()],
            default_properties: { frequency_band: '470-636 MHz', channels: 1, diversity: true, battery_hours: 11 },
          }),
          audio({
            _id: 'sennheiser-ewdx',
            type: 'wireless_mic',
            manufacturer: 'Sennheiser',
            model: 'EW-DX EM 2',
            full_name: 'Sennheiser EW-DX EM 2 Wireless Receiver',
            ports: [...xlrOuts(2), danteOut()],
            default_properties: { frequency_band: '470-694 MHz', channels: 2, diversity: true, dante: true },
          }),
        ],
      },
      {
        name: 'DI Boxes & Interfaces',
        items: [
          audio({
            _id: 'radial-j48',
            type: 'di_box',
            manufacturer: 'Radial',
            model: 'J48',
            full_name: 'Radial J48 Active Direct Box',
            ports: [trsIn(), xlrOut()],
            default_properties: { active: true, phantom_power: true, pad: 0 },
            specs: { requires_phantom: true },
          }),
          audio({
            _id: 'behringer-di20',
            type: 'di_box',
            manufacturer: 'Behringer',
            model: 'DI20',
            full_name: 'Behringer Ultra-DI DI20 Active DI (2-ch)',
            ports: [...trsIns(2), ...xlrOuts(2)],
            default_properties: { active: true, pad: 0 },
          }),
          audio({
            _id: 'focusrite-2i2',
            type: 'audio_interface',
            manufacturer: 'Focusrite',
            model: 'Scarlett 2i2',
            full_name: 'Focusrite Scarlett 2i2 (4th Gen)',
            ports: [...xlrIns(2), usbOut()],
            default_properties: { input_gain: 45, sample_rate: 48, bit_depth: 24, phantom_power: true },
          }),
        ],
      },
    ],
  },
  {
    category: 'video',
    name: 'Video Equipment',
    icon: '📹',
    subcategories: [
      {
        name: 'Cameras',
        items: [
          video({
            _id: 'sony-srg300h',
            type: 'camera',
            manufacturer: 'Sony',
            model: 'SRG-300H',
            full_name: 'Sony SRG-300H PTZ Camera',
            ports: [hdmiOut(), sdiOut()],
            default_properties: { resolution: '1920x1080', fps: 60, ptz: true, zoom: 30 },
          }),
          video({
            _id: 'panasonic-aw-ue150',
            type: 'camera',
            manufacturer: 'Panasonic',
            model: 'AW-UE150',
            full_name: 'Panasonic AW-UE150 4K PTZ Camera',
            ports: [hdmiOut(), sdiOut(), ipOut('ip_out')],
            default_properties: { resolution: '3840x2160', fps: 60, ptz: true, zoom: 20 },
          }),
          video({
            _id: 'ptzoptics-20x',
            type: 'camera',
            manufacturer: 'PTZOptics',
            model: '20X-SDI',
            full_name: 'PTZOptics 20X-SDI Camera',
            ports: [hdmiOut(), sdiOut()],
            default_properties: { resolution: '1920x1080', fps: 60, ptz: true, zoom: 20 },
          }),
          video({
            _id: 'canon-cr-n500',
            type: 'camera',
            manufacturer: 'Canon',
            model: 'CR-N500',
            full_name: 'Canon CR-N500 4K PTZ Camera',
            ports: [hdmiOut(), sdiOut(), ipOut('ip_out')],
            default_properties: { resolution: '3840x2160', fps: 60, ptz: true, zoom: 15 },
          }),
        ],
      },
      {
        name: 'Displays & Projectors',
        items: [
          video({
            _id: 'samsung-qm85r',
            type: 'display',
            manufacturer: 'Samsung',
            model: 'QM85R',
            full_name: 'Samsung QM85R 85" 4K Display',
            ports: hdmiIns(3),
            default_properties: { size_inches: 85, resolution: '3840x2160', brightness_nits: 500 },
          }),
          video({
            _id: 'lg-75up8000',
            type: 'display',
            manufacturer: 'LG',
            model: '75UP8000',
            full_name: 'LG 75" 4K UHD Display',
            ports: hdmiIns(2),
            default_properties: { size_inches: 75, resolution: '3840x2160', brightness_nits: 300 },
          }),
          video({
            _id: 'epson-l1755u',
            type: 'projector',
            manufacturer: 'Epson',
            model: 'EB-L1755U',
            full_name: 'Epson EB-L1755U Laser Projector',
            ports: [...hdmiIns(2), sdiIn()],
            default_properties: { lumens: 15000, resolution: '1920x1200', throw_ratio: 1.5 },
          }),
          video({
            _id: 'barco-f90',
            type: 'projector',
            manufacturer: 'Barco',
            model: 'F90-4K13',
            full_name: 'Barco F90-4K13 Laser Projector',
            ports: [hdmiIn('hdmi_in_1'), sdiIn()],
            default_properties: { lumens: 13000, resolution: '4096x2160', throw_ratio: 1.2 },
          }),
          video({
            _id: 'christie-dwu1100',
            type: 'projector',
            manufacturer: 'Christie',
            model: 'DWU1100-GS',
            full_name: 'Christie DWU1100-GS Laser Projector',
            ports: [hdmiIn('hdmi_in_1'), sdiIn()],
            default_properties: { lumens: 11000, resolution: '1920x1200', throw_ratio: 1.3 },
          }),
          video({
            _id: 'absen-led-wall',
            type: 'display',
            manufacturer: 'Absen',
            model: 'Acclaim Plus',
            full_name: 'Absen Acclaim Plus LED Video Wall',
            ports: [hdmiIn()],
            default_properties: { size_inches: 165, resolution: '3840x2160', brightness_nits: 800 },
          }),
        ],
      },
      {
        name: 'Switchers & Processors',
        items: [
          video({
            _id: 'extron-in1608',
            type: 'switcher',
            manufacturer: 'Extron',
            model: 'IN1608',
            full_name: 'Extron IN1608 Scaling Presentation Switcher',
            ports: [...hdmiIns(8), ...hdmiOuts(2)],
            default_properties: {
              inputs: 8,
              outputs: 2,
              switching_type: 'seamless',
              max_resolution: '1920x1200',
              resolution_out: '1920x1080',
            },
          }),
          video({
            _id: 'blackmagic-atem',
            type: 'switcher',
            manufacturer: 'Blackmagic Design',
            model: 'ATEM Mini Pro',
            full_name: 'Blackmagic ATEM Mini Pro',
            ports: [...hdmiIns(4), hdmiOut(), usbOut(), lan()],
            default_properties: { inputs: 4, outputs: 1, streaming: true, max_resolution: '1920x1080' },
          }),
          video({
            _id: 'roland-v60hd',
            type: 'switcher',
            manufacturer: 'Roland',
            model: 'V-60HD',
            full_name: 'Roland V-60HD Multi-Format Switcher',
            ports: [...sdiIns(4), ...hdmiIns(2, 5), ...sdiOuts(2), hdmiOut()],
            default_properties: { inputs: 6, outputs: 3, max_resolution: '1920x1080' },
          }),
          video({
            _id: 'kramer-vp558',
            type: 'scaler',
            manufacturer: 'Kramer',
            model: 'VP-558',
            full_name: 'Kramer VP-558 Presentation Scaler',
            ports: [...hdmiIns(2), hdmiOut()],
            default_properties: { scaling: true, resolution_out: '1920x1080' },
          }),
          video({
            _id: 'lightware-mx2-8x8',
            type: 'switcher',
            manufacturer: 'Lightware',
            model: 'MX2-8x8-HDMI20',
            full_name: 'Lightware MX2-8x8 HDMI Matrix',
            ports: [...hdmiIns(8), ...hdmiOuts(8)],
            default_properties: { inputs: 8, outputs: 8, switching_type: 'matrix', max_resolution: '3840x2160' },
          }),
        ],
      },
      {
        name: 'Media Players',
        items: [
          video({
            _id: 'brightsign-xt1144',
            type: 'media_player',
            manufacturer: 'BrightSign',
            model: 'XT1144',
            full_name: 'BrightSign XT1144 Digital Signage Player',
            ports: [hdmiOut(), lan()],
            default_properties: { resolution: '3840x2160', fps: 60, storage_gb: 32, hdr: true },
          }),
          video({
            _id: 'apple-tv-4k',
            type: 'media_player',
            manufacturer: 'Apple',
            model: 'TV 4K',
            full_name: 'Apple TV 4K (3rd Gen)',
            ports: [hdmiOut(), lan()],
            default_properties: { resolution: '3840x2160', fps: 60, hdr: true },
          }),
        ],
      },
      {
        name: 'AV-over-IP',
        items: [
          video({
            _id: 'crestron-nvx-enc',
            type: 'encoder',
            manufacturer: 'Crestron',
            model: 'DM-NVX-360 (Enc)',
            full_name: 'Crestron DM-NVX-360 Encoder',
            ports: [hdmiIn(), ipOut()],
            default_properties: { codec: 'Pixel Perfect', max_resolution: '3840x2160', bitrate_mbps: 950, latency_ms: 1 },
          }),
          video({
            _id: 'crestron-nvx-dec',
            type: 'decoder',
            manufacturer: 'Crestron',
            model: 'DM-NVX-360 (Dec)',
            full_name: 'Crestron DM-NVX-360 Decoder',
            ports: [ipIn(), hdmiOut()],
            default_properties: { codec: 'Pixel Perfect', max_resolution: '3840x2160', latency_ms: 1 },
          }),
          video({
            _id: 'extron-nav-e121',
            type: 'encoder',
            manufacturer: 'Extron',
            model: 'NAV E 121',
            full_name: 'Extron NAV E 121 AV-over-IP Encoder',
            ports: [hdmiIn(), ipOut()],
            default_properties: { codec: 'PURE3', max_resolution: '3840x2160', latency_ms: 1 },
          }),
          video({
            _id: 'extron-nav-d121',
            type: 'decoder',
            manufacturer: 'Extron',
            model: 'NAV D 121',
            full_name: 'Extron NAV D 121 AV-over-IP Decoder',
            ports: [ipIn(), hdmiOut()],
            default_properties: { codec: 'PURE3', max_resolution: '3840x2160', latency_ms: 1 },
          }),
        ],
      },
      {
        name: 'Recording & Streaming',
        items: [
          video({
            _id: 'blackmagic-hyperdeck',
            type: 'video_recorder',
            manufacturer: 'Blackmagic Design',
            model: 'HyperDeck Studio HD Mini',
            full_name: 'Blackmagic HyperDeck Studio HD Mini',
            ports: [sdiIn(), hdmiIn(), sdiOut(), hdmiOut()],
            default_properties: { format: 'ProRes', storage_gb: 512, loop_out: true },
          }),
          video({
            _id: 'teradek-vidiu',
            type: 'encoder',
            manufacturer: 'Teradek',
            model: 'VidiU Go',
            full_name: 'Teradek VidiU Go Streaming Encoder',
            ports: [hdmiIn(), sdiIn(), ipOut()],
            default_properties: { codec: 'H.264/H.265', bitrate_mbps: 20, streaming: true, max_resolution: '1920x1080' },
          }),
        ],
      },
    ],
  },
  {
    category: 'network',
    name: 'Network & Control',
    icon: '🌐',
    subcategories: [
      {
        name: 'Network Switches',
        items: [
          network({
            _id: 'cisco-sg350',
            type: 'network_switch',
            manufacturer: 'Cisco',
            model: 'SG350-28',
            full_name: 'Cisco SG350-28 Managed Switch (non-PoE)',
            ports: lans(24),
            default_properties: { ports: 24, poe: false, managed: true, vlan: true },
          }),
          network({
            _id: 'netgear-gs728tp',
            type: 'network_switch',
            manufacturer: 'Netgear',
            model: 'GS728TP',
            full_name: 'Netgear GS728TP PoE Switch',
            ports: lans(24),
            default_properties: { ports: 24, poe: true, managed: true },
          }),
        ],
      },
      {
        name: 'Audio Network',
        items: [
          audio({
            _id: 'shure-mxa910',
            type: 'array_microphone',
            manufacturer: 'Shure',
            model: 'MXA910',
            full_name: 'Shure MXA910 Ceiling Array Microphone',
            ports: [danteOut()],
            default_properties: { channels: 8, dante: true, coverage_angle: 40 },
            specs: { requires_poe: true },
          }),
          audio({
            _id: 'qsc-core-110f',
            type: 'dsp',
            manufacturer: 'QSC',
            model: 'Core 110f',
            full_name: 'QSC Core 110f Audio Processor',
            ports: [...xlrIns(8), danteIn(), ...xlrOuts(8), danteOut()],
            default_properties: { input_gain: 0, gain: 0, qsys: true, processing: 'dante', channels: 8 },
          }),
          audio({
            _id: 'biamp-tesiraforte',
            type: 'dsp',
            manufacturer: 'Biamp',
            model: 'TesiraFORTE X',
            full_name: 'Biamp TesiraFORTE X Audio DSP',
            ports: [...xlrIns(4), danteIn(), ...xlrOuts(4), danteOut()],
            default_properties: { input_gain: 0, gain: 0, channels: 12, dante: true, processing: 'aec' },
          }),
        ],
      },
      {
        name: 'Control Systems',
        items: [
          control({
            _id: 'crestron-cp3',
            type: 'controller',
            manufacturer: 'Crestron',
            model: 'CP3',
            full_name: 'Crestron CP3 Control Processor',
            ports: [lan()],
            default_properties: { control: true, programming: 'simpl' },
          }),
          control({
            _id: 'extron-ipcp-pro-550',
            type: 'controller',
            manufacturer: 'Extron',
            model: 'IPCP Pro 550',
            full_name: 'Extron IPCP Pro 550 Control Processor',
            ports: [lan()],
            default_properties: { control: true, programming: 'global_scripter' },
          }),
          control({
            _id: 'amx-nx-3200',
            type: 'controller',
            manufacturer: 'AMX',
            model: 'NX-3200',
            full_name: 'AMX NetLinx NX-3200 Controller',
            ports: [lan()],
            default_properties: { control: true, programming: 'netlinx' },
          }),
        ],
      },
      {
        name: 'Wireless & Access Points',
        items: [
          network({
            _id: 'ubiquiti-u6-pro',
            type: 'wireless_ap',
            manufacturer: 'Ubiquiti',
            model: 'UniFi U6-Pro',
            full_name: 'Ubiquiti UniFi U6-Pro Access Point',
            ports: [lan()],
            default_properties: { wifi_standard: 'Wi-Fi 6', max_clients: 300 },
            specs: { requires_poe: true },
          }),
        ],
      },
      {
        name: 'Touch Panels',
        items: [
          control({
            _id: 'crestron-tsw770',
            type: 'touch_panel',
            manufacturer: 'Crestron',
            model: 'TSW-770',
            full_name: 'Crestron TSW-770 Touch Panel',
            ports: [lan()],
            default_properties: { screen_size_in: 7 },
            specs: { requires_poe: true },
          }),
          control({
            _id: 'extron-tlp-pro-1025t',
            type: 'touch_panel',
            manufacturer: 'Extron',
            model: 'TLP Pro 1025T',
            full_name: 'Extron TLP Pro 1025T Touch Panel',
            ports: [lan()],
            default_properties: { screen_size_in: 10 },
            specs: { requires_poe: true },
          }),
        ],
      },
    ],
  },
];

export const getAllEquipment = (): EquipmentTemplate[] =>
  EQUIPMENT_LIBRARY.flatMap((category) => category.subcategories.flatMap((sub) => sub.items));

export function findEquipment(equipmentId: string): EquipmentTemplate | undefined {
  return getAllEquipment().find((e) => e._id === equipmentId);
}

/** Новый экземпляр устройства на холсте из библиотечной карточки. */
export function createDevice(tpl: EquipmentTemplate, id: string, position: { x: number; y: number }): Device {
  return {
    id,
    type: tpl.type,
    category: tpl.category,
    manufacturer: tpl.manufacturer,
    model: tpl.model,
    full_name: tpl.full_name,
    position,
    ports: tpl.ports.map((p) => ({ ...p })),
    properties: { ...tpl.default_properties },
    ...(tpl.specs ? { specs: { ...tpl.specs } } : {}),
  };
}

/**
 * Дополняет устройство из старого проекта параметрами, появившимися в каталоге
 * позже (например, усиление входа микшера), чтобы их можно было настроить.
 */
export function withTemplateDefaults(device: Device): Device {
  const tpl = getAllEquipment().find((e) => e.manufacturer === device.manufacturer && e.model === device.model);
  if (!tpl) return device;
  const missing = Object.keys(tpl.default_properties).filter((k) => !(k in device.properties));
  if (missing.length === 0) return device;
  const properties = { ...device.properties };
  for (const k of missing) properties[k] = tpl.default_properties[k];
  return { ...device, properties };
}
