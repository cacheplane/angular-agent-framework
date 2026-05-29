// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';

test.describe('cockpit interrupts: refund approval', () => {
  test('approval card displays structured payload fields', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Refund a duplicate charge').click();
    const dialog = page.locator('dialog.chat-approval-card');
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(dialog).toContainText('Refund approval required');
  });

  test('Approve issues the refund and the run finishes', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Refund a duplicate charge').click();
    const dialog = page.locator('dialog.chat-approval-card');
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await dialog.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText(/Refund of \$/i)).toBeVisible({ timeout: 20_000 });
  });

  test('Cancel skips the refund and confirms cancellation', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Refund a duplicate charge').click();
    const dialog = page.locator('dialog.chat-approval-card');
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText(/Refund cancelled by operator/i)).toBeVisible({ timeout: 20_000 });
  });
});
