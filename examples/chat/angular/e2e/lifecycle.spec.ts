// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import {
  activeThreadIdFromUrl,
  messageInput,
  openDemo,
  sendButton,
  waitForFinalAssistant,
} from './test-helpers';

test('lifecycle: reload reconnects to the active conversation', async ({
  page,
}) => {
  await openDemo(page, '/embed');
  await messageInput(page).fill('say hi briefly');
  await sendButton(page).click();
  await waitForFinalAssistant(page);

  await page.reload();
  await expect(page.locator('chat-message[data-role="user"]')).toContainText(
    'say hi briefly'
  );
  await expect(
    page.locator('chat-message[data-role="assistant"]')
  ).toContainText(/hi/i);
});

test('lifecycle: New chat (sidenav) starts a fresh thread and restores welcome state', async ({
  page,
}) => {
  await openDemo(page, '/embed');
  await messageInput(page).fill('say hi briefly');
  await sendButton(page).click();
  await waitForFinalAssistant(page);

  // After the first send the agent allocates a thread id and stamps
  // it into the URL via the signal→URL effect: /embed/<thread-id>.
  await expect(page).toHaveURL(/\/embed\/[A-Za-z0-9-]+$/);
  const threadIdBefore = await activeThreadIdFromUrl(page);

  // The toolbar "New conversation" button was removed; the sidenav's
  // "New chat" pill is now the only affordance for starting a fresh
  // thread. It creates a new thread server-side and navigates to
  // /embed/<new-thread-id>; the empty thread renders the welcome state.
  await page.getByRole('button', { name: 'New chat' }).first().click();

  await expect(
    page.getByRole('heading', { name: 'How can I help?' })
  ).toBeVisible();
  await expect(page.locator('chat-message')).toHaveCount(0);

  // URL holds a fresh thread id, different from the one we had before.
  await expect(page).toHaveURL(/\/embed\/[A-Za-z0-9-]+$/);
  const threadIdAfter = await activeThreadIdFromUrl(page);
  expect(threadIdAfter).toBeTruthy();
  expect(threadIdAfter).not.toBe(threadIdBefore);
});

test('lifecycle: selecting a welcome suggestion submits and clears welcome state', async ({
  page,
}) => {
  await openDemo(page, '/embed');
  await page
    .getByRole('button', { name: /Demo: render a contact form/i })
    .click();

  await expect(
    page.getByRole('heading', { name: 'How can I help?' })
  ).toHaveCount(0);
  await expect(page.locator('chat-message[data-role="user"]')).toContainText(
    'Show me a contact form'
  );
});
