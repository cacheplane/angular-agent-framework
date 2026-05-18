// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { openChatDevtools, openDemo } from './test-helpers';

test('chat-debug devtools: opens from the sidenav with accessible controls and closes cleanly', async ({
  page,
}) => {
  await openDemo(page, '/embed');
  await openChatDevtools(page);

  const panel = page.getByRole('region', { name: 'Chat devtools' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('tab', { name: 'Timeline' })).toBeVisible();
  await expect(panel.getByRole('tab', { name: 'State' })).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('chat-debug .panel')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Open chat devtools' })
  ).toBeVisible();
});

test.describe('chat-debug × chat-sidebar coexistence', () => {
  test('sidebar launcher remains reachable while chat-debug is open', async ({
    page,
  }) => {
    await openDemo(page, '/sidebar');
    await expect(page.locator('chat-sidebar')).toBeAttached();

    // The sidebar mode auto-opens its panel on entry; close it first so the
    // launcher becomes the visible affordance under test.
    const panelClose = page
      .locator('.chat-sidebar__panel')
      .getByRole('button', { name: /close/i });
    if (await panelClose.isVisible().catch(() => false)) {
      await panelClose.click();
    }

    // Open chat-debug from the sidenav footer.
    await openChatDevtools(page);

    // Debug auto-picks bottom dock because <chat-sidebar> is present.
    const debugPanel = page.locator('.panel.panel--bottom');
    await expect(debugPanel).toBeVisible();

    // The edge-claim attribute on <html> reflects the dock.
    await expect(page.locator('html')).toHaveAttribute(
      'data-ngaf-chat-debug',
      'bottom'
    );

    // Sidebar launcher remains visible (the bottom dock did not cover it).
    // Click the actual <button> inside <chat-launcher-button> rather than the
    // wrapping div — avoids any hit-test ambiguity between the wrapper and
    // the higher-z-index debug panel.
    const sidebarLauncherButton = page.locator(
      '.chat-sidebar__launcher button.chat-launcher-button'
    );
    await expect(sidebarLauncherButton).toBeVisible();
    await sidebarLauncherButton.click();

    // Sidebar panel slides in — the click was not intercepted by the debug
    // panel, which is the user-visible bug this design fixes.
    const sidebarPanel = page.locator('.chat-sidebar__panel[data-open="true"]');
    await expect(sidebarPanel).toBeVisible();

    // Once the sidebar is open, the edge-claim attribute reflects it too.
    await expect(page.locator('html')).toHaveAttribute(
      'data-ngaf-chat-sidebar',
      'open'
    );
  });

  test('user override survives mode switch: explicit right-dock stays right', async ({
    page,
  }) => {
    await openDemo(page, '/embed');
    await openChatDevtools(page);
    // Click right-dock explicitly — sets userDockOverride.
    await page.locator('.panel__dock-btn').nth(2).click(); // 0=left, 1=bottom, 2=right
    // Switch to sidebar mode via the demo-owned top toolbar.
    await page
      .locator('.demo-shell__segmented-button', { hasText: 'Sidebar' })
      .click();
    await openChatDevtools(page);

    // Debug stays right-docked despite chat-sidebar now being on the page.
    await expect(page.locator('.panel.panel--right')).toBeVisible();
    await expect(page.locator('.panel.panel--bottom')).not.toBeVisible();
  });
});
