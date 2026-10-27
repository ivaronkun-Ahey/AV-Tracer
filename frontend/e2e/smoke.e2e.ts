import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** Ошибки консоли (в том числе нарушения CSP) — признак поломки. */
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function openClean(page: Page) {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function loadExample(page: Page, name: string) {
  await page.getByRole('button', { name: 'Примеры' }).click();
  await page.getByText(name).click();
}

test('пример «Концертный звук»: симуляция проходит, схема сохраняется в браузере', async ({ page }) => {
  const errors = collectErrors(page);
  await openClean(page);
  await loadExample(page, 'Концертный звук');
  await expect(page.getByText('Устройств: 5')).toBeVisible();
  await expect(page.getByText(/Сохранено в браузере/)).toBeVisible();
  await page.getByRole('button', { name: 'Симуляция' }).click();
  await expect(page.getByText('Система собрана корректно')).toBeVisible();
  await expect(page.getByText('Цепочки сигнала (2)')).toBeVisible();
  expect(errors).toEqual([]);
});

test('колонка без источника — «нет сигнала»', async ({ page }) => {
  await openClean(page);
  await loadExample(page, 'Базовая система оповещения');
  // Убираем микрофон прямо из автосейва и перезагружаем страницу
  await expect(page.getByText(/Сохранено в браузере/)).toBeVisible();
  const doc = await page.evaluate(() => JSON.parse(localStorage.getItem('av-tracer:autosave') || '{}'));
  doc.devices = doc.devices.filter((d: { type: string }) => d.type !== 'microphone');
  doc.connections = doc.connections.filter((c: { from: { device: string } }) => c.from.device !== 'ex_mic');
  await page.evaluate((d) => localStorage.setItem('av-tracer:autosave', JSON.stringify(d)), doc);
  await page.reload();
  await page.getByRole('button', { name: 'Симуляция' }).click();
  await expect(page.getByText('Найдены ошибки')).toBeVisible();
  await expect(page.getByText(/не приходит звук/)).toBeVisible();
});

test('сохранение в файл и открытие обратно', async ({ page }) => {
  await openClean(page);
  await loadExample(page, 'Видео по сети');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Сохранить' }).click()]);
  const path = await download.path();
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  expect(saved.schemaVersion).toBe(2);
  expect(saved.devices).toHaveLength(4);

  await page.getByRole('button', { name: 'Очистить' }).click();
  await expect(page.getByText('Холст пуст')).toBeVisible();
  await page.setInputFiles('input[type=file]', path);
  await expect(page.getByText('Проект загружен')).toBeVisible();
  await expect(page.getByText('Устройств: 4')).toBeVisible();
});

test('экспорт: спецификация CSV и документация для печати', async ({ page }) => {
  const errors = collectErrors(page);
  await openClean(page);
  await loadExample(page, 'Концертный звук');

  await page.getByRole('button', { name: 'Экспорт' }).click();
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByText('Спецификация оборудования (CSV)').click()]);
  const text = readFileSync(await csv.path(), 'utf8');
  expect(text).toContain('Производитель');
  expect(text).toContain('EVF-1122S');

  await page.getByRole('button', { name: 'Экспорт' }).click();
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByText('Документация (печать / PDF)').click()]);
  await expect(popup.getByRole('heading', { name: 'Спецификация оборудования' })).toBeVisible();
  await expect(popup.getByRole('heading', { name: 'Кабельный журнал' })).toBeVisible();
  const imageLoaded = await popup.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
  expect(imageLoaded).toBe(true);
  expect(errors).toEqual([]);
});
