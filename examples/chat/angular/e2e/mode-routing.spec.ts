// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import {
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
  await page.locator('.chat-sidebar__launcher button.chat-launcher-button').click();
  const sidebar = page.getByRole('complementary');
  await expect(sidebar).toBeVisible();
  await expect(sidebar).toHaveAttribute('aria-hidden', 'false');
  await page.locator('.chat-sidebar__close').click();
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

  await page.goto('/popup');
  await closeChatDevtools(page);
  await page.locator('.chat-popup__launcher button.chat-launcher-button').click();
  await expect(
    page.getByRole('dialog').locator('chat-message[data-role="assistant"]'),
  ).toContainText(/hi/i, { timeout: 30_000 });

  await page.goto('/sidebar');
  await closeChatDevtools(page);
  await page.locator('.chat-sidebar__launcher button.chat-launcher-button').click();
  await expect(
    page.getByRole('complementary').locator('chat-message[data-role="assistant"]'),
  ).toContainText(/hi/i, { timeout: 30_000 });

  await page.goto('/embed');
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
