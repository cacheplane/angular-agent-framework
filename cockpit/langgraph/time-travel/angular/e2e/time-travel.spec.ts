import { expect, test } from '@playwright/test';

test.describe('LangGraph Time Travel Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4306');
    await page.waitForSelector('app-time-travel', { state: 'attached' });
  });

  test('renders the chat interface with history sidebar', async ({ page }) => {
    await expect(page.locator('cp-chat')).toBeVisible();
    await expect(page.locator('input[name="prompt"]')).toBeVisible();
    await expect(page.locator('text=History')).toBeVisible();
  });

  test('sends a message and receives a response', async ({ page }) => {
    await page.fill('input[name="prompt"]', 'hello');
    await page.click('button[type="submit"]');
    await expect(page.locator('.cp-message--ai')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.cp-message--ai .cp-message__content')).not.toBeEmpty({ timeout: 30000 });
  });
});
