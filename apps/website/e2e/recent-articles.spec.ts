import { test, expect } from '@playwright/test';

test.describe('Home page — Recent articles', () => {
  test('renders the section header on /', async ({ page }) => {
    await page.goto('/');
    // Stable id, not copy — copy changes more often than structure.
    await expect(page.locator('#recent-articles-heading')).toBeVisible();
    await expect(page.locator('#recent-articles-heading')).toHaveText(/Recent articles/i);
  });

  test('shows at least one post card linking to /blog/<slug>', async ({ page }) => {
    await page.goto('/');
    const section = page.locator('section[aria-labelledby="recent-articles-heading"]');
    await expect(section).toBeVisible();
    // At least one card with a blog post link inside the section.
    const firstCard = section.locator('a[href^="/blog/"]').first();
    await expect(firstCard).toBeVisible();
  });

  test('"View all articles" link points to /blog', async ({ page }) => {
    await page.goto('/');
    const section = page.locator('section[aria-labelledby="recent-articles-heading"]');
    const viewAll = section.getByRole('link', { name: /View all articles/i });
    await expect(viewAll).toBeVisible();
    await expect(viewAll).toHaveAttribute('href', '/blog');
  });
});
