import { describe, it, expect } from 'vitest';
import { runSimulation } from './engine';
import { createDevice, findEquipment } from '../data/equipment';
import { EXAMPLE_PROJECTS } from '../data/examples';
import { CableType, Connection, Device, PropValue, SimFix, SimIssue } from '../types/device.types';

/**
 * Приёмочные сценарии с ожиданиями, заданными вручную по физике AV-систем
 * (а не снятыми с самого движка, как эталоны shared/sim-fixtures).
 * Сценарии R1–R4 — из docs/PROJECT_REVIEW_2026-10-26.md.
 */

function dev(eq: string, id: string, props: Record<string, PropValue> = {}): Device {
  const tpl = findEquipment(eq);
  if (!tpl) throw new Error(`нет в каталоге: ${eq}`);
  const d = createDevice(tpl, id, { x: 0, y: 0 });
  Object.assign(d.properties, props);
  return d;
}

let n = 0;
function cable(from: string, fromPort: string, to: string, toPort: string, type: CableType = 'xlr'): Connection {
  n += 1;
  return { id: `c${n}`, from: { device: from, port: fromPort }, to: { device: to, port: toPort }, cable_type: type, cable_length: 5 };
}

const types = (issues: { type: string; device: string }[], device?: string) =>
  issues.filter((i) => !device || i.device === device).map((i) => i.type);
const reached = (r: ReturnType<typeof runSimulation>, sink: string) =>
  r.signal_flows.some((f) => f.path[f.path.length - 1] === sink);

describe('R1: приёмник получает сигнал только от достижимого источника', () => {
  it('микшер → колонка без источника — ошибка «нет сигнала»', () => {
    const r = runSimulation([dev('allen-heath-sq5', 'mix'), dev('jbl-prx815w', 'spk')], [cable('mix', 'xlr_out_l', 'spk', 'xlr_in')]);
    expect(r.valid).toBe(false);
    expect(types(r.errors, 'spk')).toContain('no_signal');
  });

  it('микрофон → микшер → колонка с настройками по умолчанию — система рабочая', () => {
    const r = runSimulation(
      [dev('shure-sm58', 'mic'), dev('allen-heath-sq5', 'mix'), dev('jbl-prx815w', 'spk')],
      [cable('mic', 'xlr_out', 'mix', 'xlr_in_1'), cable('mix', 'xlr_out_l', 'spk', 'xlr_in')]
    );
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(reached(r, 'spk')).toBe(true);
  });

  it('дисплей за коммутатором без камеры — ошибка «нет сигнала»', () => {
    const r = runSimulation(
      [dev('extron-in1608', 'sw'), dev('epson-l1755u', 'proj')],
      [cable('sw', 'hdmi_out_1', 'proj', 'hdmi_in_1', 'hdmi')]
    );
    expect(types(r.errors, 'proj')).toContain('no_signal');
  });
});

describe('R2: сигнал идёт только через порты и каналы, которые его передают', () => {
  it('видео не попадает в ATEM через Ethernet-порт управления', () => {
    const r = runSimulation(
      [
        dev('sony-srg300h', 'cam'),
        dev('crestron-nvx-enc', 'enc'),
        dev('cisco-sg350', 'sw'),
        dev('blackmagic-atem', 'atem'),
        dev('samsung-qm85r', 'tv'),
      ],
      [
        cable('cam', 'hdmi_out', 'enc', 'hdmi_in', 'hdmi'),
        cable('enc', 'network_out', 'sw', 'eth_1', 'cat6'),
        cable('sw', 'eth_2', 'atem', 'eth', 'cat6'),
        cable('atem', 'hdmi_out', 'tv', 'hdmi_in_1', 'hdmi'),
      ]
    );
    expect(reached(r, 'tv')).toBe(false);
    expect(r.signal_flows.some((f) => f.path.includes('atem'))).toBe(false);
    expect(types(r.errors, 'tv')).toContain('no_signal');
  });

  it('усилитель: сигнал на левом входе не выходит с правого выхода', () => {
    const r = runSimulation(
      [dev('shure-sm58', 'mic'), dev('allen-heath-sq5', 'mix'), dev('crown-xls2502', 'amp'), dev('ev-evf1122', 'spkL'), dev('ev-evf1122', 'spkR')],
      [
        cable('mic', 'xlr_out', 'mix', 'xlr_in_1'),
        cable('mix', 'xlr_out_l', 'amp', 'xlr_in_l'),
        cable('amp', 'speakon_out_l', 'spkL', 'speakon_in', 'speakon'),
        cable('amp', 'speakon_out_r', 'spkR', 'speakon_in', 'speakon'),
      ]
    );
    expect(reached(r, 'spkL')).toBe(true);
    expect(reached(r, 'spkR')).toBe(false);
    expect(types(r.errors, 'spkR')).toContain('no_signal');
  });

  it('стерео: L и R микшера доходят до своих каналов усилителя (сходящиеся пути не теряются)', () => {
    const r = runSimulation(
      [dev('shure-sm58', 'mic'), dev('allen-heath-sq5', 'mix'), dev('crown-xls2502', 'amp'), dev('ev-evf1122', 'spkL'), dev('ev-evf1122', 'spkR')],
      [
        cable('mic', 'xlr_out', 'mix', 'xlr_in_1'),
        cable('mix', 'xlr_out_l', 'amp', 'xlr_in_l'),
        cable('mix', 'xlr_out_r', 'amp', 'xlr_in_r'),
        cable('amp', 'speakon_out_l', 'spkL', 'speakon_in', 'speakon'),
        cable('amp', 'speakon_out_r', 'spkR', 'speakon_in', 'speakon'),
      ]
    );
    expect(r.errors).toEqual([]);
    expect(reached(r, 'spkL')).toBe(true);
    expect(reached(r, 'spkR')).toBe(true);
  });

  it('презентационный коммутатор пропускает только выбранный вход', () => {
    const devices = [dev('sony-srg300h', 'cam1'), dev('ptzoptics-20x', 'cam2'), dev('extron-in1608', 'sw'), dev('epson-l1755u', 'proj')];
    const conns = [
      cable('cam1', 'hdmi_out', 'sw', 'hdmi_in_1', 'hdmi'),
      cable('cam2', 'hdmi_out', 'sw', 'hdmi_in_2', 'hdmi'),
      cable('sw', 'hdmi_out_1', 'proj', 'hdmi_in_1', 'hdmi'),
    ];
    const toProj = (r: ReturnType<typeof runSimulation>) =>
      r.signal_flows.filter((f) => f.path[f.path.length - 1] === 'proj').map((f) => f.source);

    expect(toProj(runSimulation(devices, conns))).toEqual(['cam1']);
    devices[2].properties.selected_input = 2;
    expect(toProj(runSimulation(devices, conns))).toEqual(['cam2']);
  });

  it('матрица коммутирует по таблице «вход>выход»', () => {
    const devices = [
      dev('sony-srg300h', 'cam1'),
      dev('ptzoptics-20x', 'cam2'),
      dev('lightware-mx2-8x8', 'mx', { routes: '2>1, 1>2' }),
      dev('samsung-qm85r', 'tv1'),
      dev('lg-75up8000', 'tv2'),
    ];
    const conns = [
      cable('cam1', 'hdmi_out', 'mx', 'hdmi_in_1', 'hdmi'),
      cable('cam2', 'hdmi_out', 'mx', 'hdmi_in_2', 'hdmi'),
      cable('mx', 'hdmi_out_1', 'tv1', 'hdmi_in_1', 'hdmi'),
      cable('mx', 'hdmi_out_2', 'tv2', 'hdmi_in_1', 'hdmi'),
    ];
    const r = runSimulation(devices, conns);
    const sourceOf = (sink: string) => r.signal_flows.filter((f) => f.path[f.path.length - 1] === sink).map((f) => f.source);
    expect(sourceOf('tv1')).toEqual(['cam2']);
    expect(sourceOf('tv2')).toEqual(['cam1']);
  });

  it('Dante через два коммутатора — в обе стороны кабеля между коммутаторами', () => {
    for (const reversed of [false, true]) {
      const r = runSimulation(
        [dev('shure-mxa910', 'mxa'), dev('netgear-gs728tp', 'sw1'), dev('netgear-gs728tp', 'sw2'), dev('qsc-core-110f', 'core', { gain: 0 }), dev('crown-xls2502', 'amp'), dev('ev-evf1122', 'spk')],
        [
          cable('mxa', 'dante_out', 'sw1', 'eth_1', 'cat6'),
          reversed ? cable('sw2', 'eth_1', 'sw1', 'eth_2', 'cat6') : cable('sw1', 'eth_2', 'sw2', 'eth_1', 'cat6'),
          cable('sw2', 'eth_2', 'core', 'dante_in', 'cat6'),
          cable('core', 'xlr_out_1', 'amp', 'xlr_in_l'),
          cable('amp', 'speakon_out_l', 'spk', 'speakon_in', 'speakon'),
        ]
      );
      expect(reached(r, 'spk')).toBe(true);
      expect(r.errors).toEqual([]);
    }
  });
});

describe('R3: фантомное питание подаёт вход, к которому подключён микрофон', () => {
  const build = (mixerPhantom: boolean) =>
    runSimulation(
      [dev('shure-beta87a', 'mic'), dev('allen-heath-sq5', 'mix', { phantom_power: mixerPhantom }), dev('jbl-prx815w', 'spk')],
      [cable('mic', 'xlr_out', 'mix', 'xlr_in_1'), cable('mix', 'xlr_out_l', 'spk', 'xlr_in')]
    );

  it('фантом на микшере выключен — конденсаторный микрофон помечен', () => {
    const r = build(false);
    expect([...types(r.errors, 'mic'), ...types(r.warnings, 'mic')]).toContain('phantom_power');
    expect(r.valid).toBe(false);
  });

  it('фантом на микшере включён — проблем нет', () => {
    const r = build(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('конденсатор напрямую в активную АС — фантом подать некому', () => {
    const r = runSimulation([dev('shure-beta87a', 'mic'), dev('jbl-prx815w', 'spk')], [cable('mic', 'xlr_out', 'spk', 'xlr_in')]);
    expect(types(r.errors, 'mic')).toContain('phantom_power');
  });

  it('микрофон не «подаёт фантом сам себе»: у него нет такого параметра', () => {
    expect(findEquipment('shure-beta87a')!.default_properties).not.toHaveProperty('phantom_power');
  });
});

describe('R4: каталог соответствует данным производителя', () => {
  it('Yorkville YX15P — активная АС с линейным входом', () => {
    const t = findEquipment('yorkville-yx15p')!;
    expect(t.default_properties.active).toBe(true);
    expect(t.ports.some((p) => p.id === 'xlr_in')).toBe(true);
    expect(t.ports.some((p) => p.type === 'speakon')).toBe(false);
  });

  it('пример «Концертный звук» собран из пассивных АС и проходит без замечаний', () => {
    const p = EXAMPLE_PROJECTS.find((e) => e.id === 'concert')!.build();
    for (const d of p.devices.filter((x) => x.type === 'speaker')) expect(d.properties.active).toBe(false);
    const r = runSimulation(p.devices, p.connections);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    for (const d of p.devices.filter((x) => x.type === 'speaker')) expect(reached(r, d.id)).toBe(true);
  });
});

describe('Типовое оборудование: компьютер, удлинители, конвертеры, ВКС', () => {
  it('ноутбук → HDBaseT-передатчик → витая пара → приёмник → дисплей: видео доходит', () => {
    const r = runSimulation(
      [dev('generic-laptop', 'pc'), dev('generic-hdbt-tx', 'tx'), dev('generic-hdbt-rx', 'rx'), dev('lg-75up8000', 'tv')],
      [
        cable('pc', 'hdmi_out', 'tx', 'hdmi_in', 'hdmi'),
        cable('tx', 'hdbt_out', 'rx', 'hdbt_in', 'cat6'),
        cable('rx', 'hdmi_out', 'tv', 'hdmi_in_1', 'hdmi'),
      ]
    );
    expect(r.errors).toEqual([]);
    expect(r.signal_flows.find((f) => f.type === 'video')?.path).toEqual(['pc', 'tx', 'rx', 'tv']);
  });

  it('HDBaseT — не Ethernet: передатчик в сетевой коммутатор — несовместимые сигналы', () => {
    const r = runSimulation(
      [dev('generic-laptop', 'pc'), dev('generic-hdbt-tx', 'tx'), dev('cisco-sg350', 'sw')],
      [cable('pc', 'hdmi_out', 'tx', 'hdmi_in', 'hdmi'), cable('tx', 'hdbt_out', 'sw', 'eth_1', 'cat6')]
    );
    expect(types(r.errors, 'tx')).toContain('signal_mismatch');
  });

  it('звук ноутбука (линейный уровень) напрямую в активную АС — уровень в норме', () => {
    const r = runSimulation(
      [dev('generic-laptop', 'pc'), dev('jbl-prx815w', 'spk')],
      [cable('pc', 'trs_out', 'spk', 'xlr_in', 'trs')]
    );
    expect(r.errors).toEqual([]);
    expect(types(r.warnings)).not.toContain('level_low');
    expect(reached(r, 'spk')).toBe(true);
  });

  it('4K-камера через конвертер HDMI → 3G-SDI — предупреждение о разрешении на конвертере', () => {
    const r = runSimulation(
      [dev('canon-cr-n500', 'cam'), dev('generic-hdmi-to-sdi', 'conv'), dev('epson-l1755u', 'proj')],
      [cable('cam', 'hdmi_out', 'conv', 'hdmi_in', 'hdmi'), cable('conv', 'sdi_out', 'proj', 'sdi_in', 'sdi')]
    );
    expect(reached(r, 'proj')).toBe(true);
    expect(types(r.warnings, 'conv')).toContain('resolution_unsupported');
  });

  it('SDI-камера через конвертер SDI → HDMI на телевизор — видео доходит без замечаний', () => {
    const r = runSimulation(
      [dev('sony-srg300h', 'cam'), dev('generic-sdi-to-hdmi', 'conv'), dev('lg-75up8000', 'tv')],
      [cable('cam', 'sdi_out', 'conv', 'sdi_in', 'sdi'), cable('conv', 'hdmi_out', 'tv', 'hdmi_in_1', 'hdmi')]
    );
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(reached(r, 'tv')).toBe(true);
  });

  it('видеобар по USB в ноутбук, ноутбук на дисплей: изображение камеры доходит до дисплея', () => {
    const r = runSimulation(
      [dev('generic-video-bar', 'vb'), dev('generic-laptop', 'pc'), dev('lg-75up8000', 'tv')],
      [cable('vb', 'usb_out', 'pc', 'usb_in', 'usb'), cable('pc', 'hdmi_out', 'tv', 'hdmi_in_1', 'hdmi')]
    );
    expect(r.errors).toEqual([]);
    expect(r.signal_flows.some((f) => f.type === 'video' && f.path.join('>') === 'vb>pc>tv')).toBe(true);
    expect(r.signal_flows.some((f) => f.type === 'audio' && f.path.join('>') === 'vb>pc')).toBe(true);
  });

  it('документ-камера — источник видео', () => {
    const r = runSimulation(
      [dev('generic-document-camera', 'doc'), dev('epson-l1755u', 'proj')],
      [cable('doc', 'hdmi_out', 'proj', 'hdmi_in_1', 'hdmi')]
    );
    expect(r.errors).toEqual([]);
    expect(reached(r, 'proj')).toBe(true);
  });
});

describe('Примеры из меню — рабочие системы', () => {
  for (const example of EXAMPLE_PROJECTS) {
    it(`«${example.name}» — без ошибок и предупреждений, все приёмники получают сигнал`, () => {
      const { devices, connections } = example.build();
      const r = runSimulation(devices, connections);
      expect(r.errors).toEqual([]);
      expect(r.warnings).toEqual([]);
      for (const d of devices.filter((x) => ['speaker', 'subwoofer', 'display', 'projector'].includes(x.type))) {
        expect(reached(r, d.id)).toBe(true);
      }
    });
  }
});

/** Применяет исправление к копии схемы — так же, как кнопка «Исправить» в панели. */
function applyFix(devices: Device[], connections: Connection[], fix: SimFix) {
  if (fix.kind === 'remove_connection') return { devices, connections: connections.filter((c) => c.id !== fix.connection) };
  return {
    devices: devices.map((d) => (d.id === fix.device ? { ...d, properties: { ...d.properties, [fix.property]: fix.value } } : d)),
    connections,
  };
}

function fixFor(issues: SimIssue[], type: string): SimFix {
  const issue = issues.find((i) => i.type === type);
  expect(issue?.fix, `у «${type}» должно быть исправление`).toBeDefined();
  return issue!.fix!;
}

describe('«Исправить»: исправление действительно устраняет проблему', () => {
  it('фантомное питание выключено на микшере — включается на микшере, а не на микрофоне', () => {
    const devices = [dev('akg-c414', 'mic'), dev('yamaha-mg12xu', 'mix', { phantom_power: false }), dev('jbl-prx815w', 'spk')];
    const connections = [cable('mic', 'xlr_out', 'mix', 'xlr_in_1'), cable('mix', 'xlr_out_l', 'spk', 'xlr_in')];
    const fix = fixFor(runSimulation(devices, connections).errors, 'phantom_power');
    expect(fix).toMatchObject({ kind: 'set_property', device: 'mix', property: 'phantom_power', value: true });
    const after = applyFix(devices, connections, fix);
    expect(types(runSimulation(after.devices, after.connections).errors)).not.toContain('phantom_power');
  });

  it('у входа свой переключатель +48 В — включается именно он', () => {
    const devices = [dev('akg-c414', 'mic'), dev('allen-heath-sq5', 'mix', { 'phantom:xlr_in_3': false })];
    const fix = fixFor(runSimulation(devices, [cable('mic', 'xlr_out', 'mix', 'xlr_in_3')]).errors, 'phantom_power');
    expect(fix).toMatchObject({ device: 'mix', property: 'phantom:xlr_in_3', value: true });
  });

  it('микшер не подаёт фантом вообще — автоматического исправления нет', () => {
    const r = runSimulation([dev('akg-c414', 'mic'), dev('jbl-prx815w', 'spk')], [cable('mic', 'xlr_out', 'spk', 'xlr_in')]);
    expect(r.errors.find((i) => i.type === 'phantom_power')?.fix).toBeUndefined();
  });

  it('на коммутаторе выбран не тот вход — выбирается вход с камерой', () => {
    const devices = [dev('sony-srg300h', 'cam'), dev('extron-in1608', 'sw', { selected_input: 1 }), dev('epson-l1755u', 'proj')];
    const connections = [cable('cam', 'hdmi_out', 'sw', 'hdmi_in_3', 'hdmi'), cable('sw', 'hdmi_out_1', 'proj', 'hdmi_in_1', 'hdmi')];
    const fix = fixFor(runSimulation(devices, connections).errors, 'no_signal');
    expect(fix).toMatchObject({ device: 'sw', property: 'selected_input', value: 3 });
    const after = applyFix(devices, connections, fix);
    const r = runSimulation(after.devices, after.connections);
    expect(r.errors).toEqual([]);
    expect(reached(r, 'proj')).toBe(true);
  });

  it('слабый сигнал после микшера — усиление канала поднимается до номинала', () => {
    const devices = [dev('shure-sm58', 'mic'), dev('yamaha-mg12xu', 'mix', { input_gain: 0 }), dev('jbl-prx815w', 'spk')];
    const connections = [cable('mic', 'xlr_out', 'mix', 'xlr_in_2'), cable('mix', 'xlr_out_l', 'spk', 'xlr_in')];
    const fix = fixFor(runSimulation(devices, connections).warnings, 'level_low');
    expect(fix).toMatchObject({ device: 'mix', property: 'gain:xlr_in_2' });
    const after = applyFix(devices, connections, fix);
    const r = runSimulation(after.devices, after.connections);
    expect(r.warnings).toEqual([]);
    const level = r.signal_flows.find((f) => f.type === 'audio')!.final_level_db!;
    expect(level).toBeGreaterThanOrEqual(3);
    expect(level).toBeLessThanOrEqual(5);
  });

  it('перегрузка на микшере — усиление канала уменьшается', () => {
    const devices = [dev('shure-sm58', 'mic'), dev('yamaha-mg12xu', 'mix', { input_gain: 80 }), dev('jbl-prx815w', 'spk')];
    const connections = [cable('mic', 'xlr_out', 'mix', 'xlr_in_1'), cable('mix', 'xlr_out_l', 'spk', 'xlr_in')];
    const fix = fixFor(runSimulation(devices, connections).warnings, 'level_high');
    const after = applyFix(devices, connections, fix);
    expect(types(runSimulation(after.devices, after.connections).warnings)).not.toContain('level_high');
  });

  it('4K в коммутатор до 1080p — источник переводится на 1920×1080', () => {
    const devices = [dev('canon-cr-n500', 'cam'), dev('blackmagic-atem', 'atem'), dev('lg-75up8000', 'tv')];
    const connections = [cable('cam', 'hdmi_out', 'atem', 'hdmi_in_1', 'hdmi'), cable('atem', 'hdmi_out', 'tv', 'hdmi_in_1', 'hdmi')];
    const fix = fixFor(runSimulation(devices, connections).warnings, 'resolution_unsupported');
    expect(fix).toMatchObject({ device: 'cam', property: 'resolution', value: '1920x1080' });
    const after = applyFix(devices, connections, fix);
    expect(types(runSimulation(after.devices, after.connections).warnings)).not.toContain('resolution_unsupported');
  });

  it('два кабеля в один вход — лишний отключается', () => {
    const devices = [dev('shure-sm58', 'm1'), dev('shure-sm58', 'm2'), dev('yamaha-mg12xu', 'mix')];
    const connections = [cable('m1', 'xlr_out', 'mix', 'xlr_in_1'), cable('m2', 'xlr_out', 'mix', 'xlr_in_1')];
    const fix = fixFor(runSimulation(devices, connections).errors, 'input_busy');
    expect(fix).toMatchObject({ kind: 'remove_connection', connection: connections[1].id });
    const after = applyFix(devices, connections, fix);
    expect(types(runSimulation(after.devices, after.connections).errors)).not.toContain('input_busy');
  });
});

describe('Помещения', () => {
  it('длинный HDMI между помещениями — совет поставить HDBaseT; внутри помещения — обычное предупреждение', () => {
    const devices = [{ ...dev('generic-laptop', 'pc'), room: 'hall' }, { ...dev('lg-75up8000', 'tv'), room: 'lobby' }];
    const link = { ...cable('pc', 'hdmi_out', 'tv', 'hdmi_in_1', 'hdmi'), cable_length: 25 };
    const between = runSimulation(devices, [link]).warnings.find((w) => w.type === 'cable_length')!;
    expect(between.message).toContain('HDBaseT');
    const same = runSimulation(devices.map((d) => ({ ...d, room: 'hall' })), [link]).warnings.find((w) => w.type === 'cable_length')!;
    expect(same.message).not.toContain('HDBaseT');
  });
});

