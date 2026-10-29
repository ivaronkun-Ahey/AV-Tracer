import { test, expect } from '@playwright/test';

test('трансляция 100 В: пример работает, отвод выбирается из списка, перегрузка линии видна в симуляции', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Примеры' }).click();
  await page.getByText('Трансляция 100 В').click();
  await page.getByRole('button', { name: 'Симуляция' }).click();
  await expect(page.getByText('Система собрана корректно')).toBeVisible();
  await page.keyboard.press('Escape');

  // Рупоры улицы: 4 × 15 Вт = 60 Вт. Переключаем все на 30 Вт — 120 Вт из 120 Вт: больше 80 %
  const props = page.getByRole('complementary', { name: 'Свойства' });
  for (let i = 0; i < 4; i++) {
    await props.getByText('Рупорный громкоговоритель 100 В').nth(i).click();
    const tap = props.getByLabel('Отвод трансформатора (Вт)');
    await expect(tap).toHaveValue('15');
    await tap.selectOption('30');
    await props.getByRole('button', { name: 'Все устройства' }).click();
  }
  await page.getByRole('button', { name: 'Симуляция' }).click();
  await expect(page.getByText(/сумма отводов 120 Вт на 4 громкоговорителя — больше 80 % мощности канала 120 Вт/)).toBeVisible();
  expect(errors).toEqual([]);
});
