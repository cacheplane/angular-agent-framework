//
// Live-model manual check. Not run by CI (playwright matches *.spec.ts only).
//   npx nx run cockpit:serve-filesystem
//   npx playwright test cockpit/deep-agents/filesystem/angular/e2e/manual
import { expect, test } from '@playwright/test';

test.describe('Deep Agents Filesystem Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4311');
    await page.waitForSelector('app-filesystem', { state: 'attached' });
  });

  test('renders the chat interface with an empty workspace', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('textarea[name="messageText"]')).toBeVisible();
    await expect(page.locator('text=No files yet')).toBeVisible();
  });

  test('writes notes, pauses on the report, and lands it after approval', async ({ page }) => {
    await page.getByRole('button', { name: 'Runway note for KASE' }).click();

    await expect(page.locator('[data-testid="file-row"]').first()).toBeVisible({ timeout: 120000 });
    await expect(page.locator('chat-interrupt-panel')).toBeVisible({ timeout: 120000 });
    await expect(page.locator('text=awaiting approval')).toBeVisible();

    await page.locator('chat-interrupt-panel').getByRole('button', { name: /^Accept$/ }).click();
    await expect(page.locator('[data-testid="file-row"]')).toHaveCount(2, { timeout: 120000 });
  });
});
