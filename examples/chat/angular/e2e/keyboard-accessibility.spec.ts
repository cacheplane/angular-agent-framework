// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import {
  closeChatDevtools,
  messageInput,
  openDemo,
  sendButton,
  waitForFinalAssistant,
} from './test-helpers';

test('keyboard: Enter sends and Shift+Enter inserts a newline', async ({ page }) => {
  await openDemo(page, '/embed');

  const input = messageInput(page);
  await input.fill('first line');
  await input.focus();
  await page.keyboard.down('Shift');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Shift');
  await page.keyboard.type('second line');
  await expect(input).toHaveValue('first line\nsecond line');

  await input.fill('say hi briefly');
  await input.press('Enter');
  await waitForFinalAssistant(page);
  await expect(page.locator('chat-message[data-role="user"]')).toContainText('say hi briefly');
});

test('accessibility: core controls expose expected accessible names', async ({ page }) => {
  await openDemo(page, '/embed');

  await expect(sendButton(page)).toHaveAttribute('aria-label', 'Send message');

  await messageInput(page).fill('stream a long deterministic answer');
  await sendButton(page).click();

  await waitForFinalAssistant(page);
  await expect(page.getByRole('button', { name: 'Regenerate response' }).first()).toBeVisible();
  const copy = page.getByRole('button', { name: 'Copy to clipboard' }).first();
  await expect(copy).toBeVisible();
  await copy.click();
  await expect(page.getByRole('button', { name: 'Copied' }).first()).toBeVisible();
});

test('keyboard: Escape closes popup and sidebar panels', async ({ page }) => {
  await openDemo(page, '/popup');
  await closeChatDevtools(page);
  await page.locator('.chat-popup__launcher button.chat-launcher-button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.chat-popup__window[data-open="true"]')).toHaveCount(0);

  await page.goto('/sidebar');
  await closeChatDevtools(page);
  await page.locator('.chat-sidebar__launcher button.chat-launcher-button').click();
  await expect(page.getByRole('complementary')).toHaveAttribute('aria-hidden', 'false');
  await page.keyboard.press('Escape');
  await expect(page.locator('.chat-sidebar__panel')).toHaveAttribute('aria-hidden', 'true');
});
