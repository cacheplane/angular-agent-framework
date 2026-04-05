import { expect, test } from '@playwright/test';

test.describe('Deep Agents Filesystem Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4311');
    await page.waitForSelector('app-filesystem', { state: 'attached' });
  });

  test('renders the chat interface with file operations sidebar', async ({ page }) => {
    await expect(page.locator('cp-chat')).toBeVisible();
    await expect(page.locator('input[name="prompt"]')).toBeVisible();
    await expect(page.locator('text=Ask the agent to read or write a file.')).toBeVisible();
  });

  test('sends a message and receives a response', async ({ page }) => {
    await page.fill('input[name="prompt"]', 'Read the file at workspace/hello.txt');
    await page.click('button[type="submit"]');
    await expect(page.locator('.cp-message--ai')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.cp-message--ai .cp-message__content')).not.toBeEmpty({ timeout: 30000 });
  });
});
