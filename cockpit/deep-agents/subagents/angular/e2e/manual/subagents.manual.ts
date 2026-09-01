// SPDX-License-Identifier: MIT
//
// Live-model manual check. Not run by CI (playwright matches *.spec.ts only).
//   npx nx run cockpit:serve-subagents
//   npx playwright test cockpit/deep-agents/subagents/angular/e2e/manual
import { expect, test } from '@playwright/test';

test.describe('Deep Agents Subagents Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4312');
    await page.waitForSelector('app-subagents', { state: 'attached' });
  });

  test('renders the chat interface with the specialist roster', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('textarea[name="messageText"]')).toBeVisible();
    await expect(page.locator('text=field-researcher')).toBeVisible();
    await expect(page.locator('text=weather-analyst')).toBeVisible();
  });

  test('fans out to several specialists at once', async ({ page }) => {
    await page.getByRole('button', { name: 'Two airports at once' }).click();

    await expect(page.locator('chat-subagent-card').first()).toBeVisible({ timeout: 120000 });
    await expect(page.locator('chat-subagent-card')).toHaveCount(4, { timeout: 180000 });
    await expect(page.getByTestId('dispatch-count')).toBeVisible();
  });
});
