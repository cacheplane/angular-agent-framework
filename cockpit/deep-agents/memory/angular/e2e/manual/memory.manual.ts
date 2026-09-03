//
// Live-model manual check. Not run by CI (playwright matches *.spec.ts only).
//   npx nx run cockpit:serve-memory
//   npx playwright test cockpit/deep-agents/memory/angular/e2e/manual
import { expect, test } from '@playwright/test';

test.describe('Deep Agents Memory Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4313');
    await page.waitForSelector('app-da-memory', { state: 'attached' });
  });

  test('renders the chat interface with an empty memory panel', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('textarea[name="messageText"]')).toBeVisible();
    await expect(page.locator('text=Nothing remembered yet')).toBeVisible();
  });

  test('remembers across a reload', async ({ page }) => {
    await page.getByRole('button', { name: 'Tell it about your operation' }).click();
    await expect(page.locator('chat-message[data-role="assistant"]').last()).toBeVisible({
      timeout: 120000,
    });

    await page.reload();
    await page.getByRole('button', { name: 'Start over and ask what it knows' }).click();
    await expect(page.locator('[data-testid="memory-file"]')).toBeVisible({ timeout: 120000 });
    await expect(page.locator('[data-testid="memory-line"]').first()).toBeVisible();
  });
});
