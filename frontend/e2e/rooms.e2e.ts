import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function openClean(page: Page) {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

const autosave = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('av-tracer:autosave') || '{}'));

async function pickDevice(page: Page, name: RegExp) {
  const back = page.getByRole('button', { name: 'Все устройства' });
  if (await back.isVisible()) await back.click();
  await page.getByRole('complementary', { name: 'Свойства' }).getByText(name).click();
}

async function newRoom(page: Page, name: string) {
  await page.getByLabel('Помещение', { exact: true }).last().selectOption({ label: '＋ Новое помещение…' });
  await page.getByLabel('Название помещения').fill(name);
  await page.getByRole('button', { name: 'Создать' }).click();
}

test('помещения: создание, фильтр, новое устройство в помещении, файл и кабельный журнал', async ({ page }) => {
  await openClean(page);
  await page.getByRole('button', { name: 'Примеры' }).click();
  await page.getByText('Базовая система оповещения').click();

  await pickDevice(page, /SM58/);
  await newRoom(page, 'Сцена');
  await pickDevice(page, /PRX815W/);
  await page.getByLabel('Помещение', { exact: true }).last().selectOption({ label: 'Сцена' });
  await pickDevice(page, /SQ-5/);
  await newRoom(page, 'Аппаратная');

  await expect.poll(async () => (await autosave(page)).rooms?.map((r: { name: string }) => r.name)).toEqual(['Сцена', 'Аппаратная']);
  const doc = await autosave(page);
  const roomOf = (type: string) => doc.devices.find((d: { type: string }) => d.type === type).room;
  expect(roomOf('microphone')).toBe(roomOf('speaker'));
  expect(roomOf('mixer')).not.toBe(roomOf('microphone'));

  // Фильтр: показывается одно помещение, новое устройство из библиотеки попадает в него
  await page.getByRole('combobox', { name: 'Помещение' }).first().selectOption({ label: 'Аппаратная' });
  await page.getByPlaceholder(/Поиск/).fill('Ноутбук');
  await page.getByRole('button', { name: /^Ноутбук, Компьютер/ }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await autosave(page)).devices.find((d: { type: string }) => d.type === 'computer')?.room).toBe(roomOf('mixer'));

  // Файл проекта: формат 3 с помещениями
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Сохранить' }).click()]);
  const saved = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(saved.schemaVersion).toBe(5);
  expect(saved.rooms).toHaveLength(2);

  // Кабельный журнал — с помещениями концов
  await page.getByRole('button', { name: 'Экспорт' }).click();
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByText('Кабельный журнал (CSV)').click()]);
  const text = readFileSync((await csv.path())!, 'utf8');
  expect(text.split('\r\n')[0]).toContain('Помещение (откуда)');
  expect(text).toContain('Сцена');
  expect(text).toContain('Аппаратная');
});
