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

const autosave = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('av-tracer:autosave') || '{}'));

test('шкафы: добавить шкаф, поставить оборудование мышью и с клавиатуры, чертёж расположения', async ({ page }) => {
  const errors = collectErrors(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Примеры' }).click();
  await page.getByText('Видео по сети').click();

  await page.getByRole('tab', { name: 'Шкафы' }).click();
  const view = page.getByRole('region', { name: 'Шкафы' });
  await view.getByRole('button', { name: 'Добавить шкаф' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новый шкаф' });
  await dialog.getByLabel('Название').fill('ШТ-1');
  await dialog.getByLabel('Высота').selectOption('12');
  await dialog.getByRole('button', { name: 'Добавить' }).click();
  await expect(page.getByRole('tab', { name: 'Шкафы (1)' })).toBeVisible();
  const rack = view.getByRole('region', { name: 'Шкаф ШТ-1' });
  await expect(rack.getByText('занято 0U из 12U')).toBeVisible();

  // С клавиатуры: выбрать устройство и «Поставить выбранное» — в самый верх
  const loose = view.getByRole('list', { name: 'Оборудование не в шкафах' });
  await loose.getByRole('button', { name: /ENC-01/ }).click();
  await rack.getByRole('button', { name: 'Поставить выбранное' }).click();
  await expect(rack.getByRole('button', { name: /^ENC-01 .*юниты 12–12/ })).toBeVisible();

  // Мышью: перетащить на юнит 5
  await loose.getByRole('button', { name: /DEC-01/ }).dragTo(rack.locator('[data-u="5"]'));
  const dec = rack.getByRole('button', { name: /^DEC-01 .*юниты 5–5/ });
  await expect(dec).toBeVisible();
  await expect(rack.getByText('занято 2U из 12U')).toBeVisible();

  // Стрелки переставляют, Delete вынимает
  await dec.focus();
  await page.keyboard.press('ArrowDown');
  await expect(rack.getByRole('button', { name: /^DEC-01 .*юниты 4–4/ })).toBeFocused();
  // Занятое место не даётся
  await rack.getByRole('button', { name: /^ENC-01/ }).focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByText(/не помещается: в шкафу «ШТ-1» юниты 1–12/)).toBeVisible();

  // Панель свойств: шкаф и юнит выбранного устройства; одно поле обозначения
  await rack.getByRole('button', { name: /^DEC-01/ }).click();
  const props = page.getByRole('complementary', { name: 'Свойства' });
  await expect(props.getByLabel('Шкаф (1U)')).toHaveValue(/rack_/);
  await expect(props.getByLabel('Юнит (низ)')).toHaveValue('4');
  await expect(props.getByLabel('Обозначение на схеме')).toHaveCount(1);
  await rack.getByRole('button', { name: /^DEC-01/ }).press('Delete');
  await expect(loose.getByRole('button', { name: /DEC-01/ })).toBeVisible();

  // Шкаф сохраняется в проекте
  await expect.poll(async () => (await autosave(page)).racks?.map((r: { name: string }) => r.name)).toEqual(['ШТ-1']);
  const saved = await autosave(page);
  expect(saved.schemaVersion).toBe(5);
  expect(saved.devices.find((d: { tag: string }) => d.tag === 'ENC-01').rack).toEqual({ rack: saved.racks[0].id, u: 12 });

  // Чертёж: схема расположения оборудования
  await page.getByRole('button', { name: 'Экспорт' }).click();
  await page.getByText('Чертежи (ГОСТ СПДС)…').click();
  const drawings = page.getByRole('dialog', { name: 'Чертежи (ГОСТ СПДС)' });
  for (const title of ['Схема структурная', 'Схема функциональная', 'Схема соединений', 'Кабельный журнал', 'Спецификация оборудования (ГОСТ 21.110)']) {
    await drawings.getByLabel(title).uncheck();
  }
  await expect(drawings.getByLabel('Схема расположения оборудования в шкафах')).toBeChecked();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    drawings.getByRole('button', { name: 'Сформировать PDF' }).click(),
  ]);
  const pdf = await PDFDocument.load(readFileSync((await download.path())!));
  expect(pdf.getPageCount()).toBe(1);
  expect(errors).toEqual([]);
});
