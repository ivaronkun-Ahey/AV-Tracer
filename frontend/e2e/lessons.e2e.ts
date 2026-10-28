import { test, expect, Page } from '@playwright/test';

async function openClean(page: Page) {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

const autosave = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('av-tracer:autosave') || '{}'));

test('учебное задание: проверка, исправление вручную, зачёт и возврат своей схемы', async ({ page }) => {
  await openClean(page);
  // Своя схема до учебного режима
  await page.getByRole('button', { name: 'Примеры' }).click();
  await page.getByText('Видео по сети').click();
  await expect(page.getByText('Устройств: 4')).toBeVisible();

  await page.getByRole('button', { name: 'Учёба' }).click();
  await page.getByText('Неисправность: слишком тихо').click();
  const panel = page.getByRole('region', { name: 'Учебное задание' });
  await expect(panel.getByText('Неисправность: слишком тихо')).toBeVisible();
  await expect(page.getByText('Устройств: 3')).toBeVisible();

  // Первая проверка: уровень не в норме
  await panel.getByRole('button', { name: 'Проверить' }).click();
  await expect(panel.getByRole('img', { name: 'не выполнено' }).first()).toBeVisible();

  // В задании «найди неисправность» подсказки есть, а кнопки «Исправить» нет
  await panel.getByRole('button', { name: /Подсказка/ }).click();
  await expect(panel.getByText(/уровень сигнала на колонке/)).toBeVisible();
  await page.getByRole('button', { name: 'Симуляция' }).click();
  await expect(page.getByText(/Слабый сигнал/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Исправить:/ })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Исправляем сами: усиление входа микшера
  await page.getByRole('complementary', { name: 'Свойства' }).getByText(/MG12XU/).click();
  const gain = page.getByLabel('Усиление входа (дБ)');
  await gain.fill('45');
  await gain.press('Enter');
  await panel.getByRole('button', { name: 'Проверить' }).click();
  await expect(panel.getByText('Задание выполнено!')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('av-tracer:lesson') || '{}').completed)).toContain('fix-quiet');

  // Выход — возвращается своя схема
  await panel.getByRole('button', { name: 'Выйти из задания' }).click();
  await expect(page.getByText('Устройств: 4')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Учебное задание' })).toHaveCount(0);
  expect((await autosave(page)).devices).toHaveLength(4);

  // В списке задание отмечено пройденным
  await page.getByRole('button', { name: 'Учёба' }).click();
  await expect(page.getByText('Пройдено: 1 из 12')).toBeVisible();
});

test('задание со своим оборудованием: библиотека показывает только его, можно открыть всё', async ({ page }) => {
  await openClean(page);
  await page.getByRole('button', { name: 'Учёба' }).click();
  await page.getByText('Ноутбук на проектор').click();
  const library = page.getByRole('complementary', { name: 'Библиотека оборудования' });
  await expect(library.getByRole('button', { name: /^Ноутбук, Компьютер/ })).toBeVisible();
  await expect(library.getByRole('button', { name: /^SM58, Микрофон/ })).toHaveCount(0);
  await library.getByRole('button', { name: /показать всё/ }).click();
  await expect(library.getByRole('button', { name: /^SM58, Микрофон/ })).toBeVisible();
});
