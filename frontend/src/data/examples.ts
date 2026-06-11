import { Device, Connection, CableType } from '../types/device.types';
import { getAllEquipment } from './equipment';

/** Создаёт экземпляр устройства из библиотечной карточки по её _id. */
function instantiate(equipmentId: string, id: string, x: number, y: number): Device {
  const tpl = getAllEquipment().find((e) => e._id === equipmentId);
  if (!tpl) throw new Error(`Неизвестное оборудование: ${equipmentId}`);
  return {
    id,
    type: tpl.type,
    manufacturer: tpl.manufacturer,
    model: tpl.model,
    full_name: tpl.full_name,
    category: tpl.category,
    position: { x, y },
    properties: { ...tpl.default_properties },
    ports: tpl.ports,
    specs: (tpl as any).specs,
  };
}

function connect(
  from: [string, string],
  to: [string, string],
  cable: CableType
): Connection {
  return {
    id: `conn_${from[0]}_${to[0]}_${Math.random().toString(36).substr(2, 5)}`,
    from: { device: from[0], port: from[1] },
    to: { device: to[0], port: to[1] },
    cable_type: cable,
    cable_length: 10,
  };
}

export interface ExampleProject {
  id: string;
  name: string;
  description: string;
  build: () => { devices: Device[]; connections: Connection[] };
}

export const EXAMPLE_PROJECTS: ExampleProject[] = [
  {
    id: 'basic-pa',
    name: 'Базовая система оповещения (PA)',
    description: 'Микрофон → микшер → активная акустическая система',
    build: () => {
      const mic = instantiate('shure-sm58', 'ex_mic', 120, 80);
      const mixer = instantiate('allen-heath-sq5', 'ex_mixer', 120, 280);
      const speaker = instantiate('jbl-prx815w', 'ex_speaker', 120, 500);
      return {
        devices: [mic, mixer, speaker],
        connections: [
          connect(['ex_mic', 'xlr_out'], ['ex_mixer', 'xlr_in_1'], 'xlr'),
          connect(['ex_mixer', 'xlr_out_l'], ['ex_speaker', 'xlr_in'], 'xlr'),
        ],
      };
    },
  },
  {
    id: 'presentation',
    name: 'Презентационная видеосистема',
    description: 'Камера → видеокоммутатор → проектор',
    build: () => {
      const cam = instantiate('sony-srg300h', 'ex_cam', 420, 80);
      const sw = instantiate('extron-in1608', 'ex_sw', 420, 280);
      const proj = instantiate('epson-l1755u', 'ex_proj', 420, 500);
      return {
        devices: [cam, sw, proj],
        connections: [
          connect(['ex_cam', 'hdmi_out'], ['ex_sw', 'hdmi_in_1'], 'hdmi'),
          connect(['ex_sw', 'hdmi_out_1'], ['ex_proj', 'hdmi_in_1'], 'hdmi'),
        ],
      };
    },
  },
  {
    id: 'av-over-ip',
    name: 'Видео по сети (AV-over-IP)',
    description: 'Камера → кодер → декодер → дисплей',
    build: () => {
      const cam = instantiate('panasonic-aw-ue150', 'ip_cam', 720, 60);
      const enc = instantiate('crestron-nvx-enc', 'ip_enc', 720, 240);
      const dec = instantiate('crestron-nvx-dec', 'ip_dec', 720, 420);
      const display = instantiate('samsung-qm85r', 'ip_disp', 720, 600);
      return {
        devices: [cam, enc, dec, display],
        connections: [
          connect(['ip_cam', 'hdmi_out'], ['ip_enc', 'hdmi_in'], 'hdmi'),
          connect(['ip_enc', 'network_out'], ['ip_dec', 'network_in'], 'cat6'),
          connect(['ip_dec', 'hdmi_out'], ['ip_disp', 'hdmi_in_1'], 'hdmi'),
        ],
      };
    },
  },
  {
    id: 'concert',
    name: 'Концертный звук (усилитель + пассивные АС)',
    description: 'Микрофон → микшер → усилитель → две параллельные пассивные колонки',
    build: () => {
      const mic = instantiate('shure-sm58', 'c_mic', 1000, 40);
      const mix = instantiate('allen-heath-sq5', 'c_mix', 1000, 220);
      const amp = instantiate('crown-xls2502', 'c_amp', 1000, 400);
      const sp1 = instantiate('yorkville-yx15p', 'c_sp1', 900, 600);
      const sp2 = instantiate('yorkville-yx15p', 'c_sp2', 1120, 600);
      return {
        devices: [mic, mix, amp, sp1, sp2],
        connections: [
          connect(['c_mic', 'xlr_out'], ['c_mix', 'xlr_in_1'], 'xlr'),
          connect(['c_mix', 'xlr_out_l'], ['c_amp', 'xlr_in_l'], 'xlr'),
          connect(['c_amp', 'speakon_out_l'], ['c_sp1', 'speakon_in'], 'speakon'),
          connect(['c_amp', 'speakon_out_l'], ['c_sp2', 'speakon_in'], 'speakon'),
        ],
      };
    },
  },
];
