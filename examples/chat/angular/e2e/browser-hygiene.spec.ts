// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { attachBrowserHygiene, openDemo } from './test-helpers';

test('browser hygiene pilot: repeated mode switches do not leak visible chat DOM', async ({
  page,
}) => {
  await openDemo(page, '/embed');
  const hygiene = attachBrowserHygiene(page);

  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  const before = await client.send('Performance.getMetrics');

  for (let i = 0; i < 10; i++) {
    await page
      .locator('.demo-shell__segmented-button', { hasText: 'Popup' })
      .click();
    await expect(page).toHaveURL(/\/popup$/);
    await page
      .locator('.demo-shell__segmented-button', { hasText: 'Sidebar' })
      .click();
    await expect(page).toHaveURL(/\/sidebar$/);
    await page
      .locator('.demo-shell__segmented-button', { hasText: 'Embed' })
      .click();
    await expect(page).toHaveURL(/\/embed$/);
  }

  const after = await client.send('Performance.getMetrics');
  const jsHeapBefore =
    before.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0;
  const jsHeapAfter =
    after.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0;

  await expect(page.locator('embed-mode')).toHaveCount(1);
  await expect(page.locator('popup-mode')).toHaveCount(0);
  await expect(page.locator('sidebar-mode')).toHaveCount(0);
  await expect(page.locator('chat-message')).toHaveCount(0);
  expect(jsHeapAfter).toBeLessThan(jsHeapBefore + 20_000_000);
  expect(hygiene.consoleErrors).toEqual([]);
  expect(hygiene.failedRequests).toEqual([]);
});
