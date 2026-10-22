import { describe, it, expect } from 'vitest';
import { buildBom, buildCableSchedule, cableTotals, toCsv, bomCsv, documentationHtml } from './exportDocs';
import { EXAMPLE_PROJECTS } from '../data/examples';
import { withCableLabels, nextCableLabel, cablePrefix } from '../data/cableLabels';

const concert = () => {
  const p = EXAMPLE_PROJECTS.find((e) => e.id === 'concert')!.build();
  return { devices: p.devices, connections: withCableLabels(p.devices, p.connections) };
};

describe('маркировка кабелей', () => {
  it('буква по назначению и сквозная нумерация', () => {
    const { connections } = concert();
    expect(connections.map((c) => c.label)).toEqual(['A-001', 'A-002', 'S-001', 'S-002']);
  });

  it('следующий номер — после максимального, существующие метки не меняются', () => {
    const { connections } = concert();
    expect(nextCableLabel(connections, 'S')).toBe('S-003');
    expect(nextCableLabel(connections, 'V')).toBe('V-001');
    expect(withCableLabels([], connections)).toBe(connections);
  });

  it('акустический кабель помечается S независимо от сигнала', () => {
    expect(cablePrefix('analog_audio', 'speakon')).toBe('S');
    expect(cablePrefix('hdmi', 'hdmi')).toBe('V');
    expect(cablePrefix('digital_audio', 'cat6')).toBe('D');
  });
});

describe('спецификация и кабельный журнал', () => {
  it('одинаковые модели — одна строка с количеством и обозначениями', () => {
    const bom = buildBom(concert().devices);
    const yx = bom.find((r) => r.model === 'YX15P')!;
    expect(yx.qty).toBe(2);
    expect(yx.tags).toEqual(['SPK-01', 'SPK-02']);
    expect(bom.reduce((a, r) => a + r.qty, 0)).toBe(5);
  });

  it('кабельный журнал содержит концы, порты и итоги по типам', () => {
    const { devices, connections } = concert();
    const rows = buildCableSchedule(devices, connections);
    expect(rows[0]).toMatchObject({ label: 'A-001', cable: 'XLR', from: 'MIC-01 SM58', fromPort: 'XLR OUT', to: 'MIX-01 SQ-5', toPort: 'XLR IN 1' });
    expect(cableTotals(rows)).toEqual([
      { cable: 'SPEAKON', count: 2, length: 20 },
      { cable: 'XLR', count: 2, length: 20 },
    ]);
  });

  it('CSV для Excel: BOM-метка, «;», экранирование', () => {
    expect(toCsv([['a;b', 'say "hi"', 3]])).toBe('﻿"a;b";"say ""hi""";3\r\n');
    expect(bomCsv(concert().devices).split('\r\n')[0]).toContain('Производитель');
  });

  it('документация экранирует названия и содержит все разделы', () => {
    const { devices, connections } = concert();
    const html = documentationHtml('data:image/png;base64,AAA', devices, connections);
    expect(html).toContain('Allen &amp; Heath');
    expect(html).toContain('Спецификация оборудования');
    expect(html).toContain('Кабельный журнал');
    expect(html).not.toContain('Allen & Heath');
  });
});
