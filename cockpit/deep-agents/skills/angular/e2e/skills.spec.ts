import { expect, test } from '@playwright/test';

test.describe('Deep Agents Skills Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4314');
    await page.waitForSelector('app-skills', { state: 'attached' });
  });

  test('renders the chat interface with skill invocation sidebar', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('textarea[name="messageText"]')).toBeVisible();
    await expect(page.locator('text=Ask the agent to calculate, count words, or summarize text.')).toBeVisible();
  });

  test('sends a message and receives a response', async ({ page }) => {
    await page.fill('textarea[name="messageText"]', 'What is 42 times 7?');
    await page.click('button[type="submit"]');
    await expect(page.locator('.chat-md')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.chat-md')).not.toBeEmpty({ timeout: 30000 });
  });
});
