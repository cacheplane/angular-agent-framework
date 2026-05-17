import { expect, test } from '@playwright/test';

test.describe('LangGraph Interrupts Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4302');
    await page.waitForSelector('app-interrupts', { state: 'attached' });
  });

  test('renders the chat interface with approvals sidebar', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('textarea[name="messageText"]')).toBeVisible();
    await expect(page.locator('text=No pending approvals')).toBeVisible();
  });

  test('sends a message and receives a response', async ({ page }) => {
    await page.fill('textarea[name="messageText"]', 'hello');
    await page.click('button[type="submit"]');
    await expect(page.locator('.chat-md').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.chat-md').first()).not.toBeEmpty({ timeout: 30000 });
  });
});
