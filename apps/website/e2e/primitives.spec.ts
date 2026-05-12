import { test, expect } from '@playwright/test';

test.describe('UI primitives showcase', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dev/primitives');
  });

  test('renders the page heading', async ({ page }) => {
    await expect(page.locator('[data-testid="primitives-page-title"]')).toBeVisible();
  });

  test('renders LogoMark', async ({ page }) => {
    // Scope to the dev showcase main content (Nav + Footer also render LogoMark site-wide).
    const logos = page.locator('main [data-ui="logo-mark"]');
    await expect(logos).toHaveCount(3);
  });

  test('renders Eyebrow in all tones', async ({ page }) => {
    // Scope to main; Footer renders accent-toned Eyebrows for its column headings.
    await expect(page.locator('main [data-ui="eyebrow"][data-tone="muted"]').first()).toBeVisible();
    await expect(page.locator('main [data-ui="eyebrow"][data-tone="accent"]').first()).toBeVisible();
    await expect(page.locator('main [data-ui="eyebrow"][data-tone="angular"]').first()).toBeVisible();
  });

  test('renders Pill in all variants', async ({ page }) => {
    await expect(page.locator('[data-ui="pill"][data-variant="neutral"]')).toBeVisible();
    await expect(page.locator('[data-ui="pill"][data-variant="accent"]')).toBeVisible();
    await expect(page.locator('[data-ui="pill"][data-variant="angular"]')).toBeVisible();
  });

  test('renders Button variants', async ({ page }) => {
    await expect(page.locator('[data-ui="button"][data-variant="primary"]').first()).toBeVisible();
    await expect(page.locator('[data-ui="button"][data-variant="secondary"]')).toBeVisible();
    await expect(page.locator('[data-ui="button"][data-variant="ghost"]')).toBeVisible();
    // Large primary renders as an <a> with href
    const linkButton = page.locator('a[data-ui="button"][data-size="lg"]');
    await expect(linkButton).toHaveAttribute('href', '/docs');
  });

  test('renders Card variants including hoverable', async ({ page }) => {
    const cards = page.locator('[data-ui="card"]');
    await expect(cards).toHaveCount(3);
    await expect(page.locator('[data-ui="card"][data-hoverable]')).toHaveCount(1);
  });

  test('renders BrowserFrame with URL pill', async ({ page }) => {
    const frame = page.locator('[data-ui="browser-frame"]');
    await expect(frame).toBeVisible();
    await expect(frame).toContainText('cockpit.cacheplane.ai');
  });

  test('renders Section with tinted surface variant', async ({ page }) => {
    await expect(page.locator('[data-ui="section"][data-surface="tinted"]')).toBeVisible();
  });

  test('FAQ items toggle open and closed', async ({ page }) => {
    const firstItem = page.locator('[data-ui="faq-item"]').first();
    await expect(firstItem).not.toHaveAttribute('open', '');
    await firstItem.locator('summary').click();
    await expect(firstItem).toHaveAttribute('open', '');
    await firstItem.locator('summary').click();
    await expect(firstItem).not.toHaveAttribute('open', '');
  });

  test('FAQ summary is keyboard-focusable', async ({ page }) => {
    const summary = page.locator('[data-ui="faq-item"]').first().locator('summary');
    await summary.focus();
    await expect(summary).toBeFocused();
  });
});
