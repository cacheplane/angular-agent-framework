import { test, expect } from '@playwright/test';

/**
 * `--nav-h` (styles/chrome.css) is the single source of truth for every offset
 * against the fixed nav: the docs shell's top padding, the sticky sidebar and
 * TOC rails, the mobile drawer's `top`, and html's scroll-padding.
 *
 * Its value is measured from the rendered nav, not derived from the classes, so
 * it silently drifts whenever Nav.tsx changes what it shows at a breakpoint —
 * which is exactly how the 768–1023px band came to overshoot by 15px. jsdom
 * cannot measure layout, so this is the only place the two can be compared.
 *
 * The tolerance is 1px, and deliberately not 0: the declared values round *up*
 * off the measured height (58/66/81 against 57/65/81 in Chrome at dpr 1) so the
 * offset always clears the nav rather than tucking content under it, and the
 * sub-pixel height itself moves with font rendering. 1px is the rounding; the
 * bug this guards against was fifteen.
 */
const STEPS = [
  { width: 375, note: 'phone — px-6 py-4' },
  { width: 767, note: 'phone — last px before md' },
  { width: 768, note: 'tablet — md padding, no lg link row' },
  { width: 1023, note: 'tablet — last px before lg' },
  { width: 1024, note: 'desktop — lg link row appears' },
  { width: 1440, note: 'desktop' },
];

for (const step of STEPS) {
  test(`--nav-h matches the rendered nav at ${step.width}px (${step.note})`, async ({ page }) => {
    await page.setViewportSize({ width: step.width, height: 800 });
    await page.goto('/docs/langgraph/getting-started/introduction');

    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();

    const measured = await nav.evaluate((el) => el.getBoundingClientRect().height);
    const variable = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')),
    );

    expect(variable).toBeGreaterThanOrEqual(measured);
    expect(variable - measured).toBeLessThanOrEqual(1);
  });
}

test('the docs column starts directly under the nav at a tablet width', async ({ page }) => {
  // The 15px overshoot showed up here as dead space above the breadcrumb.
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('/docs/langgraph/getting-started/introduction');
  await expect(page.locator('[data-workspace-shell]')).toHaveAttribute(
    'data-hydrated',
    'true',
  );

  const navBottom = await page
    .locator('nav')
    .first()
    .evaluate((el) => el.getBoundingClientRect().bottom);
  const shellTop = await page
    .locator('.website-workspace-host .workspace-shell')
    .evaluate((el) => el.getBoundingClientRect().top);

  expect(Math.abs(shellTop - navBottom)).toBeLessThanOrEqual(1);
});

test('the workspace context drawer hangs flush off the nav at tablet width', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('/docs/langgraph/getting-started/introduction');
  await expect(page.locator('[data-workspace-shell]')).toHaveAttribute(
    'data-hydrated',
    'true',
  );

  await page.getByRole('button', { name: 'Open context' }).click();
  const overlay = page.getByRole('dialog', {
    name: 'Documentation control plane context',
  });
  await expect(overlay).toBeVisible();

  const navBottom = await page
    .locator('nav')
    .first()
    .evaluate((el) => el.getBoundingClientRect().bottom);
  const overlayTop = await overlay.evaluate((el) => el.getBoundingClientRect().top);

  expect(Math.abs(overlayTop - navBottom)).toBeLessThanOrEqual(1);
});
