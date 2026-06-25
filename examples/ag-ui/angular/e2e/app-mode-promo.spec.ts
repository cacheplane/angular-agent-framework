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
