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

test('lifecycle: new conversation clears local thread and restores welcome state', async ({
  page,
}) => {
  await openDemo(page, '/embed');
  await messageInput(page).fill('say hi briefly');
  await sendButton(page).click();
  await waitForFinalAssistant(page);

  await page.getByRole('button', { name: 'New conversation' }).click();

  await expect(
    page.getByRole('heading', { name: 'How can I help?' })
  ).toBeVisible();
  await expect(page.locator('chat-message')).toHaveCount(0);
  const threadId = await page.evaluate(() => {
    const raw = localStorage.getItem('ngaf-chat-demo:palette');
    return raw
      ? (JSON.parse(raw) as { threadId?: string | null }).threadId
      : undefined;
  });
  expect(threadId ?? null).toBeNull();
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
