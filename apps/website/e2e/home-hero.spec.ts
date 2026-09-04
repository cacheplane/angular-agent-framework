import { test, expect } from '@playwright/test';

test.describe('homepage hero', () => {
  test('install dialog opens, is keyboard operable, and copies the visible command', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await page.getByRole('button', { name: 'Install Threadplane' }).click();
    const dialog = page.getByRole('dialog', { name: 'Install Threadplane' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('radio', { name: 'Try without a backend' })).toHaveAttribute('aria-checked', 'true');
    await dialog.getByRole('radio', { name: 'Try without a backend' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('radio', { name: 'LangGraph' })).toHaveAttribute('aria-checked', 'true');
    const visible = await dialog.getByTestId('install-command').textContent();
    await dialog.getByRole('button', { name: 'Copy install command' }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(visible);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Install Threadplane' })).toBeFocused();
  });

  test('poster renders before the frame and the frame mounts on desktop', async ({ page }) => {
    await page.goto('/');
    const demo = page.locator('[data-hero-demo]');
    await expect(demo.locator('img')).toHaveAttribute('src', '/screenshots/hero-walkthrough-poster.webp');
    await expect(demo.locator('iframe')).toHaveAttribute('src', 'https://demo.threadplane.ai/hero');
  });

  test('mobile shows Play walkthrough instead of the frame', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const demo = page.locator('[data-hero-demo]');
    await demo.scrollIntoViewIfNeeded();
    await expect(demo.getByRole('button', { name: 'Play walkthrough' })).toBeVisible();
    await expect(demo.locator('iframe')).toHaveCount(0);
  });
});
