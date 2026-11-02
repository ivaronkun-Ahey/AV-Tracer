import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

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
  // Автосохранение отложено (до 0,4 с) — ждём, пока в нём появится своя схема
  await expect.poll(async () => (await autosave(page)).devices?.length).toBe(4);

  // В списке задание отмечено пройденным
  await page.getByRole('button', { name: 'Учёба' }).click();
  await expect(page.getByText('Пройдено: 1 из 17')).toBeVisible();
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

test('преподаватель: задание из схемы, прохождение, файл заданий и загрузка обратно', async ({ page }) => {
  await openClean(page);
  await page.getByRole('button', { name: 'Примеры' }).click();
  await page.getByText('Базовая система оповещения').click();
  await expect(page.getByText(/Устройств: [1-9]/)).toBeVisible();

  await page.getByRole('button', { name: 'Учёба' }).click();
  await page.getByRole('button', { name: 'Создать задание' }).click();
  const editor = page.getByRole('dialog', { name: 'Новое задание' });
  await editor.getByLabel('Название').fill('Оповещение в зале');
  await editor.getByLabel('Цель задания').fill('Соберите систему оповещения: голос с микрофона в колонках.');
  await editor.getByLabel('Подсказки').fill('Начните с микрофона.\nВыход микшера — на колонку.');
  // Без решения сохранить нельзя
  await editor.getByRole('button', { name: 'Сохранить задание' }).click();
  await expect(editor.getByText(/Задайте эталонное решение/)).toBeVisible();

  await editor.getByRole('button', { name: 'Взять текущую схему как решение' }).click();
  await expect(editor.getByLabel('Эталонное решение')).toHaveText(/устройств: \d+, кабелей: \d+/);
  await expect(editor.getByRole('checkbox', { name: 'Проверка: Звук: Микрофон → Акустическая система', exact: true })).toBeChecked();
  // И тракт решения: в обход микшера задание не засчитается
  await expect(editor.getByRole('checkbox', { name: 'Проверка: Звук: Микрофон → Акустическая система через Микшер' })).toBeChecked();
  await editor.getByRole('button', { name: 'Сохранить задание' }).click();
  await expect(page.getByText(/Задание «Оповещение в зале» сохранено/)).toBeVisible();

  // Задание в списке «Свои задания»; ученик начинает с пустого холста и оборудования задания
  await page.getByRole('button', { name: 'Учёба' }).click();
  await page.getByRole('list', { name: 'Свои задания' }).getByText('Оповещение в зале').click();
  const panel = page.getByRole('region', { name: 'Учебное задание' });
  await expect(panel.getByText('Оповещение в зале')).toBeVisible();
  await expect(page.getByText('Устройств: 0')).toBeVisible();
  const library = page.getByRole('complementary', { name: 'Библиотека оборудования' });
  await expect(library.getByRole('button', { name: /^SM58, Микрофон/ })).toBeVisible();
  await expect(library.getByRole('button', { name: /^Beta 87A, Микрофон/ })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Проверить' }).click();
  await expect(panel.getByRole('img', { name: 'не выполнено' }).first()).toBeVisible();
  await panel.getByRole('button', { name: 'Выйти из задания' }).click();
  await expect(page.getByText(/Устройств: [1-9]/)).toBeVisible();

  // Файл заданий: скачать, удалить задание, загрузить файл обратно
  await page.getByRole('button', { name: 'Учёба' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Скачать свои задания' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^av-tracer-zadaniya-\d{4}-\d{2}-\d{2}\.json$/);
  const file = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(file.lessons).toHaveLength(1);
  expect(file.lessons[0]).toMatchObject({ id: 'my-opoveshchenie-v-zale', kind: 'build', hints: ['Начните с микрофона.', 'Выход микшера — на колонку.'] });

  await page.getByRole('button', { name: 'Удалить «Оповещение в зале»' }).click();
  await expect(page.getByRole('list', { name: 'Свои задания' })).toHaveCount(0);
  await page.getByTestId('lessons-file').setInputFiles((await download.path())!);
  await expect(page.getByText('Загружено заданий: 1')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Свои задания' }).getByText('Оповещение в зале')).toBeVisible();
  // Свои задания переживают перезагрузку
  await page.reload();
  await page.getByRole('button', { name: 'Учёба' }).click();
  await expect(page.getByRole('list', { name: 'Свои задания' }).getByText('Оповещение в зале')).toBeVisible();
});

test('схема без устройств (только помещение и шкаф) переживает задание и перезагрузку', async ({ page }) => {
  await openClean(page);
  await page.evaluate(() =>
    localStorage.setItem(
      'av-tracer:autosave',
      JSON.stringify({
        schemaVersion: 5,
        meta: { object: 'Школа №1' },
        rooms: [{ id: 'hall', name: 'Актовый зал', color: '#5B8DEF' }],
        racks: [{ id: 'r1', name: 'ШТ-1', units: 42, room: 'hall' }],
        devices: [],
        connections: [],
      })
    )
  );
  await page.reload();
  await page.getByRole('button', { name: 'Учёба' }).click();
  await page.getByText('Первый звук').click();
  const panel = page.getByRole('region', { name: 'Учебное задание' });
  await expect(panel).toBeVisible();
  await expect.poll(async () => (await autosave(page)).rooms?.length ?? 0).toBe(0);

  await page.reload();
  await page.getByRole('region', { name: 'Учебное задание' }).getByRole('button', { name: 'Выйти из задания' }).click();
  await expect(page.getByText('Ваша схема возвращена')).toBeVisible();
  await expect.poll(async () => (await autosave(page)).rooms?.map((r: { name: string }) => r.name)).toEqual(['Актовый зал']);
  const saved = await autosave(page);
  expect(saved.racks.map((r: { name: string }) => r.name)).toEqual(['ШТ-1']);
  expect(saved.meta).toEqual({ object: 'Школа №1' });
});
