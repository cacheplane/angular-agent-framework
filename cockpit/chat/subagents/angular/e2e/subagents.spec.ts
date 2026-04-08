import { expect, test } from '@playwright/test';

test.describe('Chat Subagents Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4505');
    await page.waitForSelector('app-subagents', { state: 'attached' });
  });

  test('renders the chat interface with subagents sidebar', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('aside h3')).toHaveText('Active Subagents');
  });

  test('displays the agent pipeline', async ({ page }) => {
    await expect(page.locator('aside')).toContainText('Orchestrator');
    await expect(page.locator('aside')).toContainText('Research Agent');
    await expect(page.locator('aside')).toContainText('Analysis Agent');
    await expect(page.locator('aside')).toContainText('Summary Agent');
  });
});
