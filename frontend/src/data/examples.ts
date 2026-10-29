import { Device, Connection, CableType, Room } from '../types/device.types';
import { createDevice, findEquipment } from './equipment';

/** Создаёт экземпляр устройства из библиотечной карточки по её _id. */
function instantiate(equipmentId: string, id: string, x: number, y: number): Device {
  const tpl = findEquipment(equipmentId);
  if (!tpl) throw new Error(`Неизвестное оборудование: ${equipmentId}`);
  return createDevice(tpl, id, { x, y });
}

function connect(
  from: [string, string],
  to: [string, string],
  cable: CableType
): Connection {
  return {
    id: `conn_${from[0]}_${to[0]}_${Math.random().toString(36).slice(2, 7)}`,
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
  build: () => { devices: Device[]; connections: Connection[]; rooms?: Room[] };
}

export const EXAMPLE_PROJECTS: ExampleProject[] = [
  {
    id: 'basic-pa',
    name: 'Базовая система оповещения (PA)',
    description: 'Микрофон → микшер → активная акустическая система',
    build: () => {
      const mic = instantiate('shure-sm58', 'ex_mic', 40, 80);
      const mixer = instantiate('allen-heath-sq5', 'ex_mixer', 340, 80);
      const speaker = instantiate('jbl-prx815w', 'ex_speaker', 640, 80);
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
      const cam = instantiate('sony-srg300h', 'ex_cam', 40, 80);
      const sw = instantiate('extron-in1608', 'ex_sw', 340, 80);
      const proj = instantiate('epson-l1755u', 'ex_proj', 640, 80);
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
      const cam = instantiate('panasonic-aw-ue150', 'ip_cam', 40, 80);
      const enc = instantiate('crestron-nvx-enc', 'ip_enc', 340, 80);
      const dec = instantiate('crestron-nvx-dec', 'ip_dec', 640, 80);
      const display = instantiate('samsung-qm85r', 'ip_disp', 940, 80);
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
    description: 'Сцена: микрофон, усилитель, две пассивные колонки; пульт FOH в зале — кабели по 40 м',
    build: () => {
      const rooms: Room[] = [
        { id: 'c_stage', name: 'Сцена', color: '#5B8DEF' },
        { id: 'c_foh', name: 'Пульт FOH', color: '#E0A030' },
      ];
      const mic = instantiate('shure-sm58', 'c_mic', 40, 80);
      const amp = instantiate('crown-xls2502', 'c_amp', 640, 80);
      const sp1 = instantiate('ev-evf1122', 'c_sp1', 940, 80);
      const sp2 = instantiate('ev-evf1122', 'c_sp2', 940, 180);
      const mix = instantiate('allen-heath-sq5', 'c_mix', 340, 420);
      for (const d of [mic, amp, sp1, sp2]) d.room = 'c_stage';
      mix.room = 'c_foh';
      const toFoh = connect(['c_mic', 'xlr_out'], ['c_mix', 'xlr_in_1'], 'xlr');
      const fromFoh = connect(['c_mix', 'xlr_out_l'], ['c_amp', 'xlr_in_l'], 'xlr');
      toFoh.cable_length = 40;
      fromFoh.cable_length = 40;
      return {
        rooms,
        devices: [mic, mix, amp, sp1, sp2],
        connections: [
          toFoh,
          fromFoh,
          connect(['c_amp', 'speakon_out_l'], ['c_sp1', 'speakon_in'], 'speakon'),
          connect(['c_amp', 'speakon_out_l'], ['c_sp2', 'speakon_in'], 'speakon'),
        ],
      };
    },
  },
  {
    id: 'pa-100v',
    name: 'Трансляция 100 В (две зоны)',
    description: 'Микшер → усилитель 2×120 Вт: холл — 6 потолочных громкоговорителей, улица — 4 рупора; линии по проходным клеммам',
    build: () => {
      const rooms: Room[] = [
        { id: 'p_tech', name: 'Аппаратная', color: '#5B8DEF' },
        { id: 'p_hall', name: 'Холл', color: '#E0A030' },
        { id: 'p_out', name: 'Улица', color: '#43A047' },
      ];
      const mic = instantiate('shure-sm58', 'p_mic', 40, 80);
      const mix = instantiate('yamaha-mg12xu', 'p_mix', 340, 80);
      mix.properties.input_gain = 50;
      const amp = instantiate('generic-pa-amp-2x120', 'p_amp', 640, 80);
      for (const d of [mic, mix, amp]) d.room = 'p_tech';
      const hall = Array.from({ length: 6 }, (_, i) => {
        const d = instantiate('generic-ceiling-spk-100v', `p_c${i + 1}`, 940 + (i % 3) * 300, 380 + Math.floor(i / 3) * 140);
        d.room = 'p_hall';
        return d;
      });
      const street = Array.from({ length: 4 }, (_, i) => {
        const d = instantiate('generic-horn-100v', `p_h${i + 1}`, 940 + i * 300, 760);
        d.properties.tap_watts = 15;
        d.room = 'p_out';
        return d;
      });
      // Линия — от выхода усилителя к первому громкоговорителю, дальше по проходным клеммам
      const chain = (line: Device[], ampPort: string) =>
        line.map((d, i) => {
          const c = connect(i === 0 ? ['p_amp', ampPort] : [line[i - 1].id, 'line100_thru'], [d.id, 'line100_in'], 'terminal');
          c.cable_length = i === 0 ? 30 : 8;
          return c;
        });
      return {
        rooms,
        devices: [mic, mix, amp, ...hall, ...street],
        connections: [
          connect(['p_mic', 'xlr_out'], ['p_mix', 'xlr_in_1'], 'xlr'),
          connect(['p_mix', 'xlr_out_l'], ['p_amp', 'xlr_in_1'], 'xlr'),
          connect(['p_mix', 'xlr_out_r'], ['p_amp', 'xlr_in_2'], 'xlr'),
          ...chain(hall, 'line100_out_1'),
          ...chain(street, 'line100_out_2'),
        ],
      };
    },
  },
  {
    id: 'meeting-room',
    name: 'Переговорная с ВКС',
    description: 'Видеобар → ноутбук (USB) → HDBaseT по витой паре 40 м → дисплей',
    build: () => {
      const bar = instantiate('generic-video-bar', 'm_bar', 40, 80);
      const pc = instantiate('generic-laptop', 'm_pc', 340, 80);
      const tx = instantiate('generic-hdbt-tx', 'm_tx', 640, 80);
      const rx = instantiate('generic-hdbt-rx', 'm_rx', 940, 80);
      const tv = instantiate('samsung-qm85r', 'm_tv', 1240, 80);
      const run = connect(['m_tx', 'hdbt_out'], ['m_rx', 'hdbt_in'], 'cat6');
      run.cable_length = 40;
      const usb = connect(['m_bar', 'usb_out'], ['m_pc', 'usb_in'], 'usb');
      usb.cable_length = 2;
      return {
        devices: [bar, pc, tx, rx, tv],
        connections: [
          usb,
          connect(['m_pc', 'hdmi_out'], ['m_tx', 'hdmi_in'], 'hdmi'),
          run,
          connect(['m_rx', 'hdmi_out'], ['m_tv', 'hdmi_in_1'], 'hdmi'),
        ],
      };
    },
  },
];
