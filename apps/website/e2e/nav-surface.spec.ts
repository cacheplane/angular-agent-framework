import { test, expect } from '@playwright/test';
import { HERO_ROUTES } from '../src/components/shared/nav-config';

/**
 * A hand-maintained hero-route list drifts. A unit test over the list cannot
 * catch a page that stopped rendering a hero, so the guard has to visit the
 * page and read the computed background.
 *
 * The background is asserted with `toHaveCSS` rather than a one-shot
 * `getComputedStyle` read: `.nav-bar` transitions `background` over 200ms, so
 * the attribute flips a fifth of a second before the colour finishes moving,
 * and a single read lands mid-fade on a partial alpha. `toHaveCSS` retries,
 * which is what makes this assert the resting surface instead of the timing.
 */
for (const route of HERO_ROUTES) {
  test(`the nav is transparent at rest on ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(route);
    const nav = page.locator('nav').first();
    await expect(nav).toHaveAttribute('data-surface', 'transparent');
    await expect(nav).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });

  test(`the nav solidifies once ${route} is scrolled`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(route);
    await page.mouse.wheel(0, 600);

    const nav = page.locator('nav').first();
    await expect(nav).toHaveAttribute('data-surface', 'solid');
    await expect(nav).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });
}

test('the nav is solid on a route with no hero', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/docs/langgraph/getting-started/introduction');
  await expect(page.locator('nav').first()).toHaveAttribute(
    'data-surface',
    'solid',
  );
});
