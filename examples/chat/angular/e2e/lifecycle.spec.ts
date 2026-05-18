// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import {
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

  const threadIdBefore = await page.evaluate(() => {
    const raw = localStorage.getItem('ngaf-chat-demo:palette');
    return raw ? (JSON.parse(raw) as { threadId?: string | null }).threadId ?? null : null;
  });

  // The toolbar "New conversation" button was removed; the sidenav's
  // "New chat" pill is now the only affordance for starting a fresh
  // thread. It creates a new thread server-side (rather than clearing
  // local state) and routes the UI back to the welcome surface.
  await page.getByRole('button', { name: 'New chat' }).first().click();

  await expect(
    page.getByRole('heading', { name: 'How can I help?' })
  ).toBeVisible();
  await expect(page.locator('chat-message')).toHaveCount(0);

  const threadIdAfter = await page.evaluate(() => {
    const raw = localStorage.getItem('ngaf-chat-demo:palette');
    return raw ? (JSON.parse(raw) as { threadId?: string | null }).threadId ?? null : null;
  });
  // A fresh thread id was persisted, and it's different from the one we
  // had before clicking New chat.
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
