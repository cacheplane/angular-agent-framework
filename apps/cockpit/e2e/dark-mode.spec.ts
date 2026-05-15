import { expect, test } from '@playwright/test';

const COOKIE_URL = 'http://127.0.0.1:4201';

test.describe('dark mode', () => {
  test('defaults to dark when no cookie is set', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const canvas = await page
      .locator('html')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--ds-canvas').trim());
    expect(canvas).toBe('#0e1117');
  });

  test('honors theme=light cookie on server render', async ({ page, context }) => {
    await context.addCookies([
      { name: 'theme', value: 'light', url: COOKIE_URL },
    ]);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const canvas = await page
      .locator('html')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--ds-canvas').trim());
    expect(canvas).toBe('rgb(255, 255, 255)');
  });

  test('toggle flips data-theme optimistically and persists across reload', async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Wait for the POST that persists the cookie so the reload below sees it.
    const themePost = page.waitForResponse(
      (resp) => resp.url().endsWith('/api/theme') && resp.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /switch to light/i }).click();
    // Optimistic: data-theme flips synchronously
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Persistence: wait for the cookie write, then reload and confirm
    await themePost;
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
