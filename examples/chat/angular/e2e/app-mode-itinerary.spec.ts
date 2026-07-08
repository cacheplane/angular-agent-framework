// SPDX-License-Identifier: MIT
// App-mode itinerary cockpit — structural e2e. These assert layout/DOM, NOT
// map tiles (the WebGL/vector map does not render reliably in the automated
// browser, and the bundle is keyless in CI). App mode is reached via the
// URL (`?appmode=on`), which is honored regardless of the Maps key, so these
// run in keyless CI.
import { test, expect } from '@playwright/test';
import { openDemo } from './test-helpers';

test.describe('App mode — itinerary cockpit', () => {
  test('shows the cockpit with an empty prompt-to-plan state', async ({ page }) => {
    await openDemo(page, '/sidebar?appmode=on');

    // The map canvas (in the sidebar content slot) and the floating itinerary
    // overlay both mount in App mode.
    await expect(page.locator('app-map-canvas')).toBeAttached();
    await expect(page.locator('app-itinerary-panel')).toBeVisible();

    // Empty start (no seed) → the panel invites the user to ask for a plan.
    await expect(page.locator('app-itinerary-panel')).toContainText(/plan/i);

    // Layout ①: the thread sidenav collapses to the hamburger drawer in App mode.
    await expect(page.locator('.demo-shell__hamburger')).toBeVisible();
  });

  test('the closed thread drawer does not intercept clicks on the cockpit content', async ({ page }) => {
    // Regression: in App mode the thread sidenav is forced to drawer mode on
    // desktop. Its host stays a fixed, drawer-width, full-height, z-index:1001
    // box even when closed (only the inner panel slides off-screen), so without
    // pointer-events:none it swallowed clicks on the itinerary overlay + welcome
    // suggestions beneath its left strip.
    await openDemo(page, '/sidebar?appmode=on');
    await expect(page.locator('.demo-shell__hamburger')).toBeVisible(); // drawer closed

    const probe = await page.evaluate(() => {
      const host = document.querySelector('chat-sidenav') as HTMLElement | null;
      if (!host) return { ok: false as const };
      const r = host.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + Math.min(r.height / 2, 180);
      const hit = document.elementFromPoint(x, y) as HTMLElement | null;
      return {
        ok: true as const,
        pointerEvents: getComputedStyle(host).pointerEvents,
        // Does a click over the (transparent) closed-drawer box land on the
        // sidenav, or pass through to the content beneath it?
        hitInsideSidenav: !!hit && !!hit.closest('chat-sidenav'),
      };
    });

    expect(probe.ok).toBe(true);
    if (!probe.ok) return;
    expect(probe.pointerEvents).toBe('none'); // the fix: closed host is inert
    expect(probe.hitInsideSidenav).toBe(false); // clicks reach the content
  });

  test('selecting Embed turns App mode off (coercion)', async ({ page }) => {
    await openDemo(page, '/sidebar?appmode=on');
    await expect(page.locator('app-map-canvas')).toBeAttached();

    await page.getByRole('button', { name: 'Embed', exact: true }).click();

    // Embed can't coexist with the map → route drops to /embed and the cockpit
    // tears down.
    await expect(page).toHaveURL(/\/embed/);
    await expect(page.locator('app-map-canvas')).toHaveCount(0);
    await expect(page.locator('app-itinerary-panel')).toHaveCount(0);
  });
});
