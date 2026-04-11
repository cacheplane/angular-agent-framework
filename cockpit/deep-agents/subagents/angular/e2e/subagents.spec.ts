import { expect, test } from '@playwright/test';

test.describe('Deep Agents Subagents Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4312');
    await page.waitForSelector('app-subagents', { state: 'attached' });
  });

  test('renders the chat interface with subagents sidebar', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('textarea[name="messageText"]')).toBeVisible();
    await expect(page.locator('text=Ask a question to see subagent activity.')).toBeVisible();
  });

  test('sends a message and receives a response', async ({ page }) => {
    await page.fill('textarea[name="messageText"]', 'Research the history of the internet and summarize it.');
    await page.click('button[type="submit"]');
    await expect(page.locator('.chat-md')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.chat-md')).not.toBeEmpty({ timeout: 30000 });
  });
});
