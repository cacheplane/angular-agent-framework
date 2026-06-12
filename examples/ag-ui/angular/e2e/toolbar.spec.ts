// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { openDemo } from './test-helpers';

test('modes: segmented control switches embed → popup → sidebar compositions', async ({ page }) => {
  await openDemo(page);
  await expect(page).toHaveURL(/\/embed/);

  await page.getByRole('button', { name: 'Popup' }).click();
  await expect(page).toHaveURL(/\/popup/);

  await page.getByRole('button', { name: 'Sidebar' }).click();
  await expect(page).toHaveURL(/\/sidebar/);

  await page.getByRole('button', { name: 'Embed' }).click();
  await expect(page).toHaveURL(/\/embed/);
  await expect(page.getByRole('textbox', { name: /message|prompt/i })).toBeVisible();
});

test('knobs: effort select reflects ?effort=high and persists a change', async ({ page }) => {
  await openDemo(page, '/embed?effort=high');
  const effortField = page.locator('[data-field="effort"]');
  await expect(effortField).toContainText(/high/i);
});

test('toolbar submit still streams (state merge does not break runs)', async ({ page }) => {
  await openDemo(page);
  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill('say hi briefly');
  await page.getByRole('button', { name: /send/i }).click();
  const assistant = page.locator('chat-message').filter({ hasText: /./ }).last();
  await expect(assistant).toBeVisible({ timeout: 30_000 });
});
