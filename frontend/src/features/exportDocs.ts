import { Connection, Device } from '../types/device.types';
import { deviceTypeLabel, portLabel, SIGNAL_LABELS, CATEGORY_LABELS } from '../data/labels';
import { deviceTags } from '../data/deviceTags';

export interface BomRow {
  tags: string[];
  category: string;
  type: string;
  manufacturer: string;
  model: string;
  fullName: string;
  qty: number;
}

export interface CableRow {
  label: string;
  cable: string;
  length: number;
  signal: string;
  from: string;
  fromPort: string;
  to: string;
  toPort: string;
}

export interface CableTotal {
  cable: string;
  count: number;
  length: number;
}

const CATEGORY_ORDER = ['audio', 'video', 'network', 'control'];

/** Спецификация: одинаковые модели объединяются в одну строку с количеством. */
export function buildBom(devices: Device[]): BomRow[] {
  const tags = deviceTags(devices);
  const groups = new Map<string, { categoryKey: string; row: BomRow }>();
  for (const d of devices) {
    const key = `${d.manufacturer}\u0000${d.model}`;
    const group = groups.get(key);
    if (group) {
      group.row.qty += 1;
      group.row.tags.push(tags[d.id]);
    } else {
      groups.set(key, {
        categoryKey: d.category,
        row: {
          tags: [tags[d.id]],
          category: CATEGORY_LABELS[d.category] ?? d.category,
          type: deviceTypeLabel(d.type),
          manufacturer: d.manufacturer,
          model: d.model,
          fullName: d.full_name,
          qty: 1,
        },
      });
    }
  }
  return [...groups.values()]
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.categoryKey) - CATEGORY_ORDER.indexOf(b.categoryKey) ||
        a.row.type.localeCompare(b.row.type, 'ru') ||
        a.row.manufacturer.localeCompare(b.row.manufacturer) ||
        a.row.model.localeCompare(b.row.model)
    )
    .map((g) => g.row);
}

/** Кабельный журнал: каждый кабель с маркировкой, длиной и концами. */
export function buildCableSchedule(devices: Device[], connections: Connection[]): CableRow[] {
  const tags = deviceTags(devices);
  const byId = Object.fromEntries(devices.map((d) => [d.id, d]));
  const endName = (id: string) => (byId[id] ? `${tags[id]} ${byId[id].model}` : id);
  const endPort = (deviceId: string, portId: string) => {
    const port = byId[deviceId]?.ports.find((p) => p.id === portId);
    return port ? portLabel(port) : portId;
  };
  return connections
    .map((c) => {
      const signal = byId[c.from.device]?.ports.find((p) => p.id === c.from.port)?.signal_type;
      return {
        label: c.label ?? '',
        cable: c.cable_type.toUpperCase(),
        length: c.cable_length,
        signal: signal ? SIGNAL_LABELS[signal] : '',
        from: endName(c.from.device),
        fromPort: endPort(c.from.device, c.from.port),
        to: endName(c.to.device),
        toPort: endPort(c.to.device, c.to.port),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
}

/** Итоги для заказа кабеля: количество и суммарная длина по типам. */
export function cableTotals(rows: CableRow[]): CableTotal[] {
  const totals = new Map<string, CableTotal>();
  for (const r of rows) {
    const t = totals.get(r.cable) ?? { cable: r.cable, count: 0, length: 0 };
    t.count += 1;
    t.length += r.length;
    totals.set(r.cable, t);
  }
  return [...totals.values()].sort((a, b) => a.cable.localeCompare(b.cable));
}

/**
 * Текст, который табличный редактор принял бы за формулу (=, +, -, @, табуляция,
 * перевод строки в начале), получает впереди апостроф и остаётся текстом.
 * Числа (длины, количества) выводятся как числа.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
}

/** CSV для Excel в русской локали: разделитель «;», BOM для UTF-8. */
export function toCsv(rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = typeof v === 'number' ? String(v) : neutralizeFormula(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

export function bomCsv(devices: Device[]): string {
  const rows = buildBom(devices);
  return toCsv([
    ['№', 'Обозначения', 'Категория', 'Тип', 'Производитель', 'Модель', 'Наименование', 'Кол-во'],
    ...rows.map((r, i) => [i + 1, r.tags.join(', '), r.category, r.type, r.manufacturer, r.model, r.fullName, r.qty]),
  ]);
}

export function cableScheduleCsv(devices: Device[], connections: Connection[]): string {
  const rows = buildCableSchedule(devices, connections);
  return toCsv([
    ['Метка', 'Тип кабеля', 'Длина, м', 'Сигнал', 'Откуда', 'Порт', 'Куда', 'Порт'],
    ...rows.map((r) => [r.label, r.cable, r.length, r.signal, r.from, r.fromPort, r.to, r.toPort]),
    [],
    ['Итого', 'Тип кабеля', 'Длина, м', 'Кол-во'],
    ...cableTotals(rows).map((t) => ['', t.cable, t.length, t.count]),
  ]);
}

export function downloadFile(name: string, content: Blob | string, type = 'text/csv;charset=utf-8') {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadDataUrl(name: string, dataUrl: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  a.click();
}

export function dateStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

const esc = (s: string | number) =>
  String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string);

/**
 * Документация для печати или сохранения в PDF (через диалог печати браузера):
 * лист со схемой и штампом, затем спецификация и кабельный журнал.
 */
export function documentationHtml(imageUrl: string, devices: Device[], connections: Connection[], date = new Date()) {
  const bom = buildBom(devices);
  const cables = buildCableSchedule(devices, connections);
  const totals = cableTotals(cables);
  const day = date.toLocaleDateString('ru-RU');
  const table = (head: string[], body: (string | number)[][]) =>
    `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body
      .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`;

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>AV-Tracer — документация ${esc(day)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 11px/1.4 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111; }
  .sheet { page-break-after: always; display: flex; flex-direction: column; min-height: 180mm; }
  h1 { font-size: 15px; margin: 0 0 6px; }
  h2 { font-size: 13px; margin: 14px 0 6px; }
  .drawing { flex: 1; display: flex; align-items: center; justify-content: center; border: 1px solid #555; padding: 4mm; }
  .drawing img { max-width: 100%; max-height: 150mm; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #888; padding: 2px 6px; text-align: left; vertical-align: top; }
  th { background: #eef1f5; }
  .stamp { width: 110mm; margin: 4mm 0 0 auto; }
  .stamp td:first-child { width: 38mm; color: #444; }
  .totals { width: 90mm; }
  @media screen { body { padding: 16px; background: #f3f4f6; } .sheet, .tables { background: #fff; padding: 12px; margin-bottom: 16px; } }
</style>
</head>
<body>
<section class="sheet">
  <h1>Структурная схема AV-системы</h1>
  <div class="drawing"><img src="${imageUrl}" alt="Схема"></div>
  <table class="stamp">
    <tr><td>Документ</td><td>Структурная схема, спецификация, кабельный журнал</td></tr>
    <tr><td>Дата</td><td>${esc(day)}</td></tr>
    <tr><td>Состав</td><td>Устройств: ${devices.length} · кабелей: ${connections.length}</td></tr>
    <tr><td>Выполнено</td><td>AV-Tracer</td></tr>
  </table>
</section>
<section class="tables">
  <h2>Спецификация оборудования</h2>
  ${table(
    ['№', 'Обозначения', 'Тип', 'Производитель', 'Модель', 'Наименование', 'Кол-во'],
    bom.map((r, i) => [i + 1, r.tags.join(', '), r.type, r.manufacturer, r.model, r.fullName, r.qty])
  )}
  <h2>Кабельный журнал</h2>
  ${table(
    ['Метка', 'Кабель', 'Длина, м', 'Сигнал', 'Откуда', 'Порт', 'Куда', 'Порт'],
    cables.map((r) => [r.label, r.cable, r.length, r.signal, r.from, r.fromPort, r.to, r.toPort])
  )}
  <h2>Итого кабеля</h2>
  <div class="totals">${table(
    ['Тип', 'Кол-во', 'Длина, м'],
    totals.map((t) => [t.cable, t.count, t.length])
  )}</div>
</section>
<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 300); });</script>
</body>
</html>`;
}
