import { expect, test } from '@playwright/test';

test.describe('Deep Agents Memory Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4313');
    await page.waitForSelector('app-da-memory', { state: 'attached' });
  });

  test('renders the chat interface with memory sidebar', async ({ page }) => {
    await expect(page.locator('cp-chat')).toBeVisible();
    await expect(page.locator('input[name="prompt"]')).toBeVisible();
    await expect(page.locator('text=Tell the agent something about yourself to see it remember.')).toBeVisible();
  });

  test('sends a message and receives a response', async ({ page }) => {
    await page.fill('input[name="prompt"]', 'My name is Alex and I love hiking.');
    await page.click('button[type="submit"]');
    await expect(page.locator('.cp-message--ai')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.cp-message--ai .cp-message__content')).not.toBeEmpty({ timeout: 30000 });
  });
});
