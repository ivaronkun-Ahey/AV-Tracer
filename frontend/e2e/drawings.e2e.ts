import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { unzipSync, strFromU8 } from 'fflate';

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('чертежи по ГОСТ СПДС: штамп сохраняется в проекте, PDF с выбранными листами', async ({ page }) => {
  const errors = collectErrors(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Примеры' }).click();
  await page.getByText('Концертный звук').click();

  await page.getByRole('button', { name: 'Экспорт' }).click();
  await page.getByText('Чертежи (ГОСТ СПДС)…').click();
  const dialog = page.getByRole('dialog', { name: 'Чертежи (ГОСТ СПДС)' });
  await dialog.getByLabel('Обозначение (шифр)').fill('2026-07-СС');
  await dialog.getByLabel('Наименование объекта').fill('Концертная площадка');
  await dialog.getByLabel('Разработал').fill('Иванов');
  await dialog.getByLabel('Схема функциональная').uncheck();

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    dialog.getByRole('button', { name: 'Сформировать PDF' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^2026-07-SS-chertezhi-\d{4}-\d{2}-\d{2}\.pdf$/);
  const pdf = await PDFDocument.load(readFileSync((await download.path())!));
  // Структурная, соединений, кабельный журнал, спецификация
  expect(pdf.getPageCount()).toBe(4);
  expect(pdf.getTitle()).toContain('2026-07-СС');
  await expect(page.getByText(/PDF сформирован/)).toBeVisible();

  // Данные штампа сохранились в проекте
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('av-tracer:autosave') || '{}').meta))
    .toMatchObject({ code: '2026-07-СС', developer: 'Иванов', stage: 'Р' });
  expect(errors).toEqual([]);
});

test('чертежи в DXF, SVG и VSDX: те же листы, файлы для САПР, векторных редакторов и Visio', async ({ page }) => {
  const errors = collectErrors(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Примеры' }).click();
  await page.getByText('Концертный звук').click();

  const open = async () => {
    await page.getByRole('button', { name: 'Экспорт' }).click();
    await page.getByText('Чертежи (ГОСТ СПДС)…').click();
    const dialog = page.getByRole('dialog', { name: 'Чертежи (ГОСТ СПДС)' });
    await dialog.getByLabel('Обозначение (шифр)').fill('2026-07-СС');
    return dialog;
  };

  let dialog = await open();
  await dialog.getByLabel('Файл').selectOption('dxf');
  const [dxf] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    dialog.getByRole('button', { name: 'Сформировать DXF' }).click(),
  ]);
  expect(dxf.suggestedFilename()).toMatch(/^2026-07-SS-chertezhi-\d{4}-\d{2}-\d{2}\.dxf$/);
  const text = new TextDecoder('windows-1251').decode(readFileSync((await dxf.path())!));
  expect(text.startsWith('0\r\nSECTION\r\n2\r\nHEADER')).toBe(true);
  expect(text).toContain('AC1009');
  expect(text).toContain('Схема структурная');
  await expect(page.getByText(/DXF сформирован, листов: 5/)).toBeVisible();

  dialog = await open();
  await dialog.getByLabel('Файл').selectOption('svg');
  for (const title of ['Схема функциональная', 'Схема соединений', 'Кабельный журнал', 'Спецификация оборудования (ГОСТ 21.110)']) {
    await dialog.getByLabel(title).uncheck();
  }
  const [svg] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    dialog.getByRole('button', { name: 'Сформировать SVG' }).click(),
  ]);
  expect(svg.suggestedFilename()).toMatch(/\.svg$/);
  const markup = readFileSync((await svg.path())!, 'utf8');
  expect(markup).toContain('width="420mm"');
  expect(markup).toContain('Схема структурная');

  dialog = await open();
  await dialog.getByLabel('Файл').selectOption('vsdx');
  const [vsdx] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    dialog.getByRole('button', { name: 'Сформировать VSDX' }).click(),
  ]);
  expect(vsdx.suggestedFilename()).toMatch(/\.vsdx$/);
  const files = unzipSync(readFileSync((await vsdx.path())!));
  // Выбор листов запоминается между открытиями диалога: осталась только структурная схема
  expect(strFromU8(files['visio/pages/pages.xml']).match(/<Page /g)).toHaveLength(1);
  expect(strFromU8(files['visio/pages/page1.xml'])).toContain('<Text>Схема структурная</Text>');
  expect(errors).toEqual([]);
});
