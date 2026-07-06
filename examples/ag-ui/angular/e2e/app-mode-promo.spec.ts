// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { openDemo } from './test-helpers';

// In sidebar mode with App mode off, the left area shows a marketing hero for
// App mode (not the old launcher hint).
test('sidebar mode shows the App-mode promo with the Threadplane pills', async ({ page }) => {
  await openDemo(page, '/sidebar');

  const promo = page.locator('app-mode-promo');
  await expect(promo).toBeVisible();
  await expect(promo).toContainText('See your trip come alive on a live map');
  await expect(promo.locator('.promo__pill')).toHaveCount(4);
});

// The chat is a floating launcher in popup mode, so the area behind it shows
// the same promo hero (App mode off).
test('popup mode also shows the App-mode promo', async ({ page }) => {
  await openDemo(page, '/popup');

  const promo = page.locator('popup-mode app-mode-promo');
  await expect(promo).toBeVisible();
  await expect(promo.locator('.promo__pill')).toHaveCount(4);
});

// App mode runs in popup too: the map cockpit fills the background behind the
// floating launcher (promo replaced by the live map). App mode is forced on via
// the URL — the toolbar toggle is key-gated in CI, but the URL drives appMode
// regardless and the app-body renders independent of the (absent) map.
test('App mode runs in popup mode with the map cockpit behind the chat', async ({ page }) => {
  await openDemo(page, '/popup?appmode=on');

  await expect(page.locator('.ag-ui-shell__app-body')).toBeVisible();
  await expect(page.locator('popup-mode')).toBeVisible();
  await expect(page.locator('app-map-canvas')).toHaveCount(1);
  // The promo background is replaced by the live map cockpit in App mode.
  await expect(page.locator('app-mode-promo')).toHaveCount(0);
});

// Switching between popup and sidebar keeps App mode on (both host the cockpit).
test('switching between popup and sidebar preserves App mode', async ({ page }) => {
  await openDemo(page, '/popup?appmode=on');
  await expect(page.locator('.ag-ui-shell__app-body')).toBeVisible();

  await page.getByRole('button', { name: 'Sidebar' }).click();
  await expect(page).toHaveURL(/\/sidebar/);
  await expect(page.locator('.ag-ui-shell__app-body')).toBeVisible();
  await expect(page.locator('sidebar-mode')).toBeVisible();

  await page.getByRole('button', { name: 'Popup' }).click();
  await expect(page).toHaveURL(/\/popup/);
  await expect(page.locator('.ag-ui-shell__app-body')).toBeVisible();
  await expect(page.locator('popup-mode')).toBeVisible();
});

test('sidebar App mode keeps the map framed when the chat rail closes and reopens', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openDemo(page, '/sidebar?appmode=on');

  const sidebar = page.locator('chat-sidebar');
  const map = page.locator('sidebar-mode app-map-canvas');
  const panel = page.locator('.chat-sidebar__panel');

  await expect(sidebar).toHaveAttribute('data-open', 'true');
  await expect(panel).toHaveAttribute('data-open', 'true');
  await expect(map).toBeVisible();

  async function layoutState(): Promise<{
    contentWidth: number;
    contentRight: number;
    mapWidth: number;
    mapRight: number;
    marginRight: string;
    rootClaim: string | null;
    occupyRight: string;
  }> {
    return page.evaluate(() => {
      const contentEl = document.querySelector('.chat-sidebar__content');
      const mapEl = document.querySelector('sidebar-mode app-map-canvas');
      if (!contentEl || !mapEl) throw new Error('App-mode map layout elements missing');
      const contentRect = contentEl.getBoundingClientRect();
      const mapRect = mapEl.getBoundingClientRect();
      const contentStyle = getComputedStyle(contentEl);
      const root = document.documentElement;
      const rootStyle = getComputedStyle(root);
      return {
        contentWidth: contentRect.width,
        contentRight: contentRect.right,
        mapWidth: mapRect.width,
        mapRight: mapRect.right,
        marginRight: contentStyle.marginRight,
        rootClaim: root.getAttribute('data-threadplane-chat-sidebar'),
        occupyRight: rootStyle.getPropertyValue('--tplane-chat-occupy-right').trim(),
      };
    });
  }

  await expect.poll(async () => parseFloat((await layoutState()).marginRight)).toBeGreaterThan(300);
  const openLayout = await layoutState();
  expect(openLayout.rootClaim).toBe('open');
  expect(parseFloat(openLayout.marginRight)).toBeGreaterThan(300);
  expect(openLayout.contentWidth).toBeGreaterThan(500);
  expect(openLayout.mapWidth).toBeCloseTo(openLayout.contentWidth, 0);
  expect(openLayout.mapRight).toBeCloseTo(openLayout.contentRight, 0);

  await page.getByRole('button', { name: 'Close chat' }).click();
  await expect(sidebar).toHaveAttribute('data-open', 'false');
  await expect(panel).toHaveAttribute('data-open', 'false');
  await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible();
  await expect.poll(async () => parseFloat((await layoutState()).marginRight)).toBe(0);

  const closedLayout = await layoutState();
  expect(closedLayout.rootClaim).toBeNull();
  expect(closedLayout.occupyRight).toBe('0px');
  expect(parseFloat(closedLayout.marginRight)).toBe(0);
  expect(closedLayout.contentWidth).toBeGreaterThan(openLayout.contentWidth);
  expect(closedLayout.mapWidth).toBeCloseTo(closedLayout.contentWidth, 0);
  expect(closedLayout.mapRight).toBeCloseTo(closedLayout.contentRight, 0);

  await page.getByRole('button', { name: 'Open chat' }).click();
  await expect(sidebar).toHaveAttribute('data-open', 'true');
  await expect(panel).toHaveAttribute('data-open', 'true');
  await expect.poll(async () => parseFloat((await layoutState()).marginRight)).toBeGreaterThan(300);

  const reopenedLayout = await layoutState();
  expect(reopenedLayout.rootClaim).toBe('open');
  expect(parseFloat(reopenedLayout.marginRight)).toBeGreaterThan(300);
  expect(reopenedLayout.contentWidth).toBeGreaterThan(500);
  expect(reopenedLayout.contentWidth).toBeLessThan(closedLayout.contentWidth);
  expect(reopenedLayout.mapWidth).toBeCloseTo(reopenedLayout.contentWidth, 0);
  expect(reopenedLayout.mapRight).toBeCloseTo(reopenedLayout.contentRight, 0);
});

// Embed is full-chat with no background, so it can't host App mode: choosing
// Embed from App mode turns App mode off.
test('choosing embed from App mode turns App mode off and shows the full chat', async ({ page }) => {
  await openDemo(page, '/sidebar?appmode=on');
  await expect(page.locator('.ag-ui-shell__app-body')).toBeVisible();

  await page.getByRole('button', { name: 'Embed' }).click();

  await expect(page.locator('embed-mode')).toBeVisible();
  await expect(page.locator('.ag-ui-shell__app-body')).toHaveCount(0);
  await expect(page).toHaveURL(/\/embed/);
});
