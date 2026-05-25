import { test, expect } from '@playwright/test';

const SLUGS = ['compliance', 'analytics', 'customer-support'];

test.describe('Solutions detail pages', () => {
  for (const slug of SLUGS) {
    test(`/solutions/${slug} renders the new sections`, async ({ page }) => {
      await page.goto(`/solutions/${slug}`);
      // Hero
      await expect(page.locator('#solution-hero-heading')).toBeVisible();
      // Pain points section heading
      await expect(page.getByText('Why this is hard today.').first()).toBeVisible();
      // Architecture section heading
      await expect(page.getByText('How the three libraries compose.').first()).toBeVisible();
      // Capabilities section heading
      await expect(page.getByText('Capabilities the framework delivers.').first()).toBeVisible();
      // FinalCTA picks up the per-solution headline
      await expect(page.locator('#final-cta-heading')).toBeVisible();
    });
  }

  test('/solutions/compliance shows the @threadplane/langgraph package pill', async ({ page }) => {
    await page.goto('/solutions/compliance');
    await expect(page.getByText('@threadplane/langgraph').first()).toBeVisible();
  });

  test('/solutions/unknown-slug returns 404', async ({ page }) => {
    const response = await page.goto('/solutions/unknown-slug');
    expect(response?.status()).toBe(404);
  });
});
