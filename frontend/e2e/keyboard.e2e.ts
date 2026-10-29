import { test, expect, Page } from '@playwright/test';

async function openClean(page: Page) {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

/** Добавляет устройство с клавиатуры: фокус на карточке библиотеки и Enter. */
async function addByKeyboard(page: Page, search: string, card: RegExp) {
  await page.getByPlaceholder(/Поиск/).fill(search);
  await page.getByRole('button', { name: card }).focus();
  await page.keyboard.press('Enter');
}

async function connectFromPanel(page: Page, port: string, target: RegExp) {
  await page.getByLabel('Порт этого устройства').selectOption({ label: port });
  const choice = page.getByLabel('С чем соединить');
  const option = choice.locator('option').filter({ hasText: target }).first();
  await choice.selectOption({ value: (await option.getAttribute('value'))! });
  await page.getByRole('button', { name: 'Соединить' }).click();
}

async function autosave(page: Page) {
  await expect(page.getByText(/Сохранено в браузере/)).toBeVisible();
  return page.evaluate(() => JSON.parse(localStorage.getItem('av-tracer:autosave') || '{}'));
}

test('схема без мыши: добавление из библиотеки, кабели из панели, симуляция', async ({ page }) => {
  await openClean(page);
  await addByKeyboard(page, 'SM58', /^SM58, Микрофон/);
  await addByKeyboard(page, 'MG12XU', /^MG12XU, Микшер/);
  await addByKeyboard(page, 'YX15P', /^YX15P/);
  await expect(page.getByText('Устройств: 3')).toBeVisible();

  // Устройства не легли друг на друга
  const doc = await autosave(page);
  const spots = new Set(doc.devices.map((d: { position: { x: number; y: number } }) => `${d.position.x},${d.position.y}`));
  expect(spots.size).toBe(3);

  // Выбрана колонка (последняя добавленная) — возвращаемся к списку и выбираем микрофон
  await page.getByRole('button', { name: 'Все устройства' }).click();
  await page.getByRole('list', { name: 'Устройства на схеме' }).getByText(/SM58/).click();
  await connectFromPanel(page, 'XLR OUT (выход)', /MG12XU · XLR IN 1$/);
  await page.getByRole('button', { name: 'Все устройства' }).click();
  await page.getByRole('list', { name: 'Устройства на схеме' }).getByText(/YX15P/).click();
  await connectFromPanel(page, 'XLR IN (вход)', /MG12XU · XLR OUT L$/);
  await expect(page.getByText('Соединений: 2')).toBeVisible();

  await page.getByRole('button', { name: 'Симуляция' }).click();
  await expect(page.getByText('Цепочки сигнала (1)')).toBeVisible();
  await expect(page.getByText('Найдены ошибки')).toHaveCount(0);
});

test('стрелки сдвигают выбранное устройство, Ctrl+Z возвращает одним шагом', async ({ page }) => {
  await openClean(page);
  await addByKeyboard(page, 'SM58', /^SM58, Микрофон/);
  const before = (await autosave(page)).devices[0].position;
  await page.getByRole('application', { name: /Холст схемы/ }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  await expect
    .poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('av-tracer:autosave')!))).devices[0].position)
    .toEqual({ x: before.x + 40, y: before.y + 100 });
  await page.keyboard.press('Control+z');
  await expect
    .poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('av-tracer:autosave')!))).devices[0].position)
    .toEqual(before);
});

test('панели сворачиваются, холст занимает место', async ({ page }) => {
  await openClean(page);
  const canvas = page.getByRole('application', { name: /Холст схемы/ });
  const wideBefore = (await canvas.boundingBox())!.width;
  await page.getByRole('button', { name: 'Скрыть библиотеку' }).click();
  await page.getByRole('button', { name: 'Скрыть свойства' }).click();
  await expect(page.getByRole('complementary', { name: 'Библиотека оборудования' })).toBeHidden();
  await expect.poll(async () => (await canvas.boundingBox())!.width).toBeGreaterThan(wideBefore + 500);
  // Выбор запоминается
  await page.reload();
  await expect(page.getByRole('button', { name: 'Показать библиотеку' })).toBeVisible();
});

test.describe('телефон', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('без горизонтальной прокрутки, библиотека и свойства открываются поверх холста', async ({ page }) => {
    await openClean(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    for (const name of ['Показать библиотеку', 'Симуляция', 'Показать свойства', 'Ещё']) {
      await expect(page.getByRole('button', { name })).toBeInViewport();
    }
    await page.getByRole('button', { name: 'Показать библиотеку' }).click();
    await page.getByPlaceholder(/Поиск/).fill('SM58');
    await page.getByRole('button', { name: /^SM58, Микрофон/ }).locator('button').click();
    // Панель закрылась, устройство на схеме и выбрано
    await expect(page.getByRole('complementary', { name: 'Библиотека оборудования' })).toBeHidden();
    await expect(page.getByText('Устройств: 1')).toBeVisible();
    await page.getByRole('button', { name: 'Показать свойства' }).click();
    await expect(page.getByLabel('Обозначение на схеме')).toHaveValue('MIC-01');
    // Второстепенные действия — в меню «Ещё»
    await page.getByRole('button', { name: 'Ещё' }).click();
    await page.getByRole('menuitem', { name: 'Примеры…' }).click();
    await expect(page.getByRole('menuitem', { name: /Концертный звук/ })).toBeVisible();
  });
});
