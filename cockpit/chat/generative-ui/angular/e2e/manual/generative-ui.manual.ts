import { expect, test } from '@playwright/test';

test.describe('Generative UI - SaaS Dashboard', () => {
  test('chat interface loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('chat')).toBeVisible({ timeout: 10000 });
  });

  test('sidebar renders generative-ui description', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.locator('aside, [role="complementary"]');
    await expect(sidebar.getByText(/render specs|dashboard/i)).toBeVisible({ timeout: 10000 });
  });
});
