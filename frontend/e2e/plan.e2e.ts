import { test, expect } from '@playwright/test';

const autosave = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('av-tracer:autosave') || '{}'));

test('план помещения: размеры, расстановка, перетаскивание и клавиатура, длины кабелей по плану', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Примеры' }).click();
  await page.getByText('Концертный звук').click();

  await page.getByRole('tab', { name: 'План' }).click();
  const view = page.getByRole('region', { name: 'План помещения' });
  await expect(view.getByLabel('Помещение', { exact: true })).toHaveValue('c_stage');
  await expect(view.getByText(/Задайте ширину и длину помещения «Сцена»/)).toBeVisible();
  await view.getByLabel('Ширина, м').fill('14');
  await view.getByLabel('Ширина, м').press('Enter');
  await view.getByLabel('Длина, м').fill('9');
  await view.getByLabel('Длина, м').press('Enter');
  const plan = view.getByRole('img', { name: 'План «Сцена»: 14 × 9 м' });
  await expect(plan).toBeVisible();

  // «На план» — каждое устройство на свободное место, не друг на друга
  const loose = view.getByRole('list', { name: 'Устройства не на плане' });
  for (let i = 0; i < 4; i++) await loose.getByRole('button', { name: 'На план' }).first().click();
  await expect(view.getByText('Все устройства помещения стоят на плане.')).toBeVisible();
  const places = await view.locator('g[role="button"]').evaluateAll((els) => els.map((e) => e.getAttribute('transform')));
  expect(new Set(places).size).toBe(4);

  // Перетаскивание: AMP-01 — в левый нижний угол (за стену нельзя — встаёт у стены)
  const amp = view.getByRole('button', { name: /^AMP-01 на плане/ });
  const box = (await plan.boundingBox())!;
  const a = (await amp.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 2, box.y + box.height - 2, { steps: 6 });
  await page.mouse.up();
  await expect(view.getByRole('button', { name: /^AMP-01 на плане: 0 × 9 м/ })).toBeVisible();

  // Клавиатура: сдвиг на 1 м (Shift+стрелка), поворот R
  const spk = view.getByRole('button', { name: /^SPK-01 на плане/ });
  await spk.focus();
  const before = (await spk.getAttribute('aria-label'))!;
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('r');
  await expect(spk).not.toHaveAttribute('aria-label', before);
  await expect(spk).toHaveAttribute('aria-label', /направление 45°/);

  // Длины кабелей усилитель → АС пересчитываются по плану (в пределах «Сцены»)
  await view.getByRole('button', { name: 'Длины кабелей по плану' }).click();
  await expect(page.getByText(/Длины по плану: обновлено кабелей — 2/)).toBeVisible();
  await expect
    .poll(async () => {
      const doc = await autosave(page);
      return doc.devices.filter((d: { plan?: unknown }) => d.plan).length;
    })
    .toBe(4);
  const doc = await autosave(page);
  expect(doc.rooms.find((r: { id: string }) => r.id === 'c_stage').size).toEqual({ width: 14, length: 9 });
  const lengths = doc.connections.filter((c: { cable_type: string }) => c.cable_type === 'speakon').map((c: { cable_length: number }) => c.cable_length);
  expect(lengths.every((l: number) => l >= 2 && l <= 25)).toBe(true);
  expect(errors).toEqual([]);
});
