// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import {
  activeThreadIdFromUrl,
  closeChatDevtools,
  messageInput,
  openDemo,
  sendButton,
  waitForFinalAssistant,
} from './test-helpers';

test('mode routing: embed, popup, and sidebar expose the expected landmarks', async ({
  page,
}) => {
  await openDemo(page, '/embed');
  await expect(page.locator('embed-mode chat')).toBeVisible();

  await page.goto('/popup');
  await expect(page.locator('popup-mode chat-popup')).toBeVisible();
  await closeChatDevtools(page);
  await page.locator('.chat-popup__launcher button.chat-launcher-button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('.chat-popup__close').click();
  await expect(page).toHaveURL(/\/popup$/);

  await page.goto('/sidebar');
  await expect(page.locator('sidebar-mode chat-sidebar')).toBeVisible();
  await closeChatDevtools(page);
  // Sidebar mode auto-opens the panel on entry — no launcher click needed.
  const sidebar = page.getByRole('complementary');
  await expect(sidebar).toBeVisible();
  await expect(sidebar).toHaveAttribute('aria-hidden', 'false');
  // Escape dismisses the panel (closeOnEscape default true on chat-sidebar).
  // Avoids click-action races against any overlapping debug/sidenav chrome.
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/sidebar$/);
  await expect(page.locator('.chat-sidebar__panel')).toHaveAttribute('aria-hidden', 'true');
});

test('cross-mode persistence: conversation follows embed, popup, and sidebar', async ({
  page,
}) => {
  await openDemo(page, '/embed');
  await messageInput(page).fill('say hi briefly');
  await sendButton(page).click();
  await waitForFinalAssistant(page);

  // Capture the active thread id from the URL — post-URL-as-truth the
  // path is /embed/<thread-id>. Cross-mode persistence works by
  // navigating to /<other-mode>/<thread-id> directly (bare-mode URLs
  // intentionally do NOT restore the last thread — that would conflate
  // user intent with browser-local state).
  await expect(page).toHaveURL(/\/embed\/[A-Za-z0-9-]+$/);
  const threadId = await activeThreadIdFromUrl(page);
  expect(threadId).toBeTruthy();

  await page.goto(`/popup/${threadId}`);
  await closeChatDevtools(page);
  await page.locator('.chat-popup__launcher button.chat-launcher-button').click();
  await expect(
    page.getByRole('dialog').locator('chat-message[data-role="assistant"]'),
  ).toContainText(/hi/i, { timeout: 30_000 });

  await page.goto(`/sidebar/${threadId}`);
  await closeChatDevtools(page);
  // Sidebar mode auto-opens the panel; assert the existing conversation
  // is visible without a launcher click.
  await expect(
    page.getByRole('complementary').locator('chat-message[data-role="assistant"]'),
  ).toContainText(/hi/i, { timeout: 30_000 });

  await page.goto(`/embed/${threadId}`);
  await expect(page.locator('embed-mode chat-message[data-role="assistant"]')).toContainText(/hi/i, {
    timeout: 30_000,
  });
});

test('mode routing: browser back and forward move between modes', async ({ page }) => {
  await openDemo(page, '/embed');
  await page.goto('/popup');
  await page.goto('/sidebar');

  await page.goBack();
  await expect(page).toHaveURL(/\/popup$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/embed$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/popup$/);
});
