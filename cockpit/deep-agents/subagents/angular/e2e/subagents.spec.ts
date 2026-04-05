import { expect, test } from '@playwright/test';

test.describe('Deep Agents Subagents Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4312');
    await page.waitForSelector('app-subagents', { state: 'attached' });
  });

  test('renders the chat interface with subagents sidebar', async ({ page }) => {
    await expect(page.locator('cp-chat')).toBeVisible();
    await expect(page.locator('input[name="prompt"]')).toBeVisible();
    await expect(page.locator('text=Ask a question to see subagent activity.')).toBeVisible();
  });

  test('sends a message and receives a response', async ({ page }) => {
    await page.fill('input[name="prompt"]', 'Research the history of the internet and summarize it.');
    await page.click('button[type="submit"]');
    await expect(page.locator('.cp-message--ai')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.cp-message--ai .cp-message__content')).not.toBeEmpty({ timeout: 30000 });
  });
});
