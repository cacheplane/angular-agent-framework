import { test, expect } from '@playwright/test';

test('homepage demo: launch opens a modal, Esc closes it', async ({ page }) => {
  await page.goto('/');
  const launch = page.getByRole('button', { name: /launch .* live demo/i }).first();
  await launch.scrollIntoViewIfNeeded();
  await launch.click();

  const dialog = page.getByRole('dialog', { name: /live demo/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('iframe')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(launch).toBeFocused();
});

test('homepage demo: in-modal tabs switch the runtime', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /launch .* live demo/i }).first().click();
  const dialog = page.getByRole('dialog', { name: /live demo/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('tab', { name: 'AG-UI' }).click();
  await expect(dialog.getByText('ag-ui.threadplane.ai')).toBeVisible();
});
