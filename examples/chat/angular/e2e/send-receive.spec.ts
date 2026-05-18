// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import {
  attachBrowserHygiene,
  messageInput,
  openDemo,
  sendButton,
  sendPromptAndWait,
  waitForFinalAssistant,
} from './test-helpers';

test('hi: assistant bubble renders non-empty text from the replayed fixture', async ({ page }) => {
  const bubble = await sendPromptAndWait(page, 'say hi briefly');
  const finalText = await bubble.innerText();
  expect(finalText.trim()).toMatch(/hi/i);
});

test('send and receive: input clears, user renders immediately, stream completes idle', async ({
  page,
}) => {
  await openDemo(page, '/embed');
  const hygiene = attachBrowserHygiene(page);

  const input = messageInput(page);
  await input.fill('stream a long deterministic answer');
  await sendButton(page).click();

  await expect(input).toHaveValue('');
  await expect(page.locator('chat-message[data-role="user"]')).toContainText(
    'stream a long deterministic answer',
  );

  const bubble = await waitForFinalAssistant(page);
  await expect(bubble).toContainText('Streaming smoke response begins');
  await expect(sendButton(page)).toBeDisabled();
  await input.fill('ready for another prompt');
  await expect(sendButton(page)).toBeEnabled();

  const scroll = page.locator('.chat-scroll');
  await expect
    .poll(async () =>
      scroll.evaluate((el) => Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight - 4),
    )
    .toBe(true);

  expect(hygiene.consoleErrors).toEqual([]);
  expect(hygiene.failedRequests).toEqual([]);
});
