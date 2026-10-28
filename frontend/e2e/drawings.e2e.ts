import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';

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
  await page.getByText('Чертежи (PDF, ГОСТ СПДС)…').click();
  const dialog = page.getByRole('dialog', { name: 'Чертежи (PDF, ГОСТ СПДС)' });
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
  const meta = await page.evaluate(() => JSON.parse(localStorage.getItem('av-tracer:autosave') || '{}').meta);
  expect(meta).toMatchObject({ code: '2026-07-СС', developer: 'Иванов', stage: 'Р' });
  expect(errors).toEqual([]);
});
