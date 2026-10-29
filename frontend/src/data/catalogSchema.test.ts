import { describe, it, expect } from 'vitest';
import { expandPortSpec, parseCatalog, portFromId } from './catalogSchema';
import { EQUIPMENT_LIBRARY, getAllEquipment } from './equipment';
import { DEVICE_TYPE_LABELS, SUBCATEGORY_LABELS } from './labels';
import { deviceIconPath } from '../components/deviceIcons';
import catalogJson from './catalog.json';

describe('короткая запись портов', () => {
  it('тип, направление и сигнал определяются по префиксу', () => {
    expect(portFromId('xlr_thru')).toEqual({ id: 'xlr_thru', type: 'xlr', direction: 'output', signal_type: 'analog_audio' });
    expect(portFromId('eth')).toMatchObject({ type: 'cat6', direction: 'bidirectional', signal_type: 'network' });
    expect(portFromId('hdbt_out')).toMatchObject({ type: 'cat6', direction: 'output', signal_type: 'hdbaset' });
    expect(() => portFromId('foo_in')).toThrow('foo_in');
  });

  it('серии портов: «xlr_in*3» и «hdmi_in*2@5»', () => {
    expect(expandPortSpec('xlr_in*3').map((p) => p.id)).toEqual(['xlr_in_1', 'xlr_in_2', 'xlr_in_3']);
    expect(expandPortSpec('hdmi_in*2@5').map((p) => p.id)).toEqual(['hdmi_in_5', 'hdmi_in_6']);
  });
});

describe('каталог оборудования', () => {
  const all = getAllEquipment();

  it('загружается из catalog.json', () => {
    expect(all.length).toBeGreaterThanOrEqual(60);
  });

  it('у каждой карточки известный тип, подпись и пиктограмма', () => {
    for (const t of all) {
      expect(DEVICE_TYPE_LABELS[t.type], t._id).toBeTruthy();
      expect(deviceIconPath(t.type), t._id).toBeTruthy();
    }
    for (const cat of EQUIPMENT_LIBRARY) {
      for (const sub of cat.subcategories) expect(SUBCATEGORY_LABELS[sub.name], sub.name).toBeTruthy();
    }
  });

  it('ошибки в файле каталога сообщаются с путём до поля', () => {
    const broken = JSON.parse(JSON.stringify(catalogJson));
    delete broken.categories[0].subcategories[0].items[0].model;
    expect(() => parseCatalog(broken)).toThrow(/categories\.0\.subcategories\.0\.items\.0\.model/);

    const dup = JSON.parse(JSON.stringify(catalogJson));
    dup.categories[0].subcategories[0].items.push(dup.categories[0].subcategories[0].items[0]);
    expect(() => parseCatalog(dup)).toThrow('повторяется _id');

    const badPort = JSON.parse(JSON.stringify(catalogJson));
    badPort.categories[0].subcategories[0].items[0].ports = ['mystery_out'];
    expect(() => parseCatalog(badPort)).toThrow('mystery_out');
  });
});
