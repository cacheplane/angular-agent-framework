import { expect, test } from '@playwright/test';

test.describe('LangGraph Subgraphs Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4305');
    await page.waitForSelector('app-subgraphs', { state: 'attached' });
  });

  test('renders the chat interface with subagent sidebar', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('textarea[name="messageText"]')).toBeVisible();
    await expect(page.locator('text=No active subagents')).toBeVisible();
  });

  test('sends a message and receives a response', async ({ page }) => {
    await page.fill('textarea[name="messageText"]', 'hello');
    await page.click('button[type="submit"]');
    await expect(page.locator('.chat-md')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.chat-md')).not.toBeEmpty({ timeout: 30000 });
  });
});
