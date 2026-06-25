// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { openDemo } from './test-helpers';

// In sidebar mode with App mode off, the left area shows a marketing hero for
// App mode (not the old launcher hint). A direct /sidebar URL bounces to /embed
// on first load (the shell persist effect's route-relative navigate), so we
// reach sidebar mode by clicking the toolbar "Sidebar" button after load.
test('sidebar mode shows the App-mode promo with the Threadplane pills', async ({ page }) => {
  await openDemo(page, '/');

  await page.getByRole('button', { name: 'Sidebar' }).click();

  const promo = page.locator('app-mode-promo');
  await expect(promo).toBeVisible();
  await expect(promo).toContainText('See your trip come alive on a live map');
  await expect(promo.locator('.promo__pill')).toHaveCount(4);
});

// The chat is a floating launcher in popup mode, so the area behind it shows
// the same promo hero (App mode off).
test('popup mode also shows the App-mode promo', async ({ page }) => {
  await openDemo(page, '/');

  await page.getByRole('button', { name: 'Popup' }).click();

  const promo = page.locator('popup-mode app-mode-promo');
  await expect(promo).toBeVisible();
  await expect(promo.locator('.promo__pill')).toHaveCount(4);
});

// Choosing a full-chat layout (embed/popup) from App mode turns App mode off.
// App mode is forced on via the URL here — the toolbar toggle is disabled
// without a Maps key in CI, but the URL drives appMode regardless and the
// app-body renders independent of the (absent) map.
test('choosing embed from App mode turns App mode off and shows the full chat', async ({ page }) => {
  await openDemo(page, '/?appmode=on');
  await expect(page.locator('.ag-ui-shell__app-body')).toBeVisible();

  await page.getByRole('button', { name: 'Embed' }).click();

  await expect(page.locator('embed-mode')).toBeVisible();
  await expect(page.locator('.ag-ui-shell__app-body')).toHaveCount(0);
  await expect(page).toHaveURL(/\/embed/);
});
