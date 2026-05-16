// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';

test.describe('chat-debug × chat-sidebar coexistence', () => {
  test('sidebar launcher remains reachable while chat-debug is open', async ({ page }) => {
    await page.goto('/sidebar');

    // Open chat-debug via its floating top-right launcher (class `.launcher`
    // on the chat-debug host — sidebar's launcher uses a different class).
    await page.locator('.launcher').click();

    // Debug auto-picks bottom dock because <chat-sidebar> is present.
    const debugPanel = page.locator('.panel.panel--bottom');
    await expect(debugPanel).toBeVisible();

    // The edge-claim attribute on <html> reflects the dock.
    await expect(page.locator('html')).toHaveAttribute('data-ngaf-chat-debug', 'bottom');

    // Sidebar launcher remains visible (the bottom dock did not cover it).
    // Click the actual <button> inside <chat-launcher-button> rather than the
    // wrapping div — avoids any hit-test ambiguity between the wrapper and
    // the higher-z-index debug panel.
    const sidebarLauncherButton = page.locator('.chat-sidebar__launcher button.chat-launcher-button');
    await expect(sidebarLauncherButton).toBeVisible();
    await sidebarLauncherButton.click();

    // Sidebar panel slides in — the click was not intercepted by the debug
    // panel, which is the user-visible bug this design fixes.
    const sidebarPanel = page.locator('.chat-sidebar__panel[data-open="true"]');
    await expect(sidebarPanel).toBeVisible();

    // Once the sidebar is open, the edge-claim attribute reflects it too.
    await expect(page.locator('html')).toHaveAttribute('data-ngaf-chat-sidebar', 'open');
  });

  test('user override survives mode switch: explicit right-dock stays right', async ({ page }) => {
    await page.goto('/embed');
    await page.locator('.launcher').click();
    // Click right-dock explicitly — sets userDockOverride.
    await page.locator('.panel__dock-btn').nth(2).click(); // 0=left, 1=bottom, 2=right
    // Switch to sidebar mode via the debug palette's Mode segmented control.
    await page.locator('.segmented__btn', { hasText: 'Sidebar' }).click();
    // Debug stays right-docked despite chat-sidebar now being on the page.
    await expect(page.locator('.panel.panel--right')).toBeVisible();
    await expect(page.locator('.panel.panel--bottom')).not.toBeVisible();
  });
});
