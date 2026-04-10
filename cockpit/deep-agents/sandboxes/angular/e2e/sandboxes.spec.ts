import { expect, test } from '@playwright/test';

test.describe('Deep Agents Sandboxes Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4315');
    await page.waitForSelector('app-sandboxes', { state: 'attached' });
  });

  test('renders the chat interface with execution log sidebar', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('input[name="prompt"]')).toBeVisible();
    await expect(page.locator('text=Ask the agent to write and run Python code.')).toBeVisible();
  });

  test('sends a message and receives a response', async ({ page }) => {
    await page.fill('input[name="prompt"]', 'Write a Python script that prints the first 5 Fibonacci numbers.');
    await page.click('button[type="submit"]');
    await expect(page.locator('.chat-md')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.chat-md')).not.toBeEmpty({ timeout: 30000 });
  });
});
