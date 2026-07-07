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
