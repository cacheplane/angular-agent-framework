// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { attachBrowserHygiene, messageInput, openDemo, sendButton } from './test-helpers';

test.skip('stop mid-stream: stop button aborts the run and leaves the partial response', async ({
  page,
}) => {
  await openDemo(page, '/embed');
  const hygiene = attachBrowserHygiene(page);

  await messageInput(page).fill('stream a long deterministic answer');
  await sendButton(page).click();

  const stop = page.getByRole('button', { name: 'Stop generating' });
  await expect(stop).toBeVisible({ timeout: 10_000 });
  await stop.click();

  await expect(stop).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('chat-message[data-role="assistant"]').last()).toBeAttached();
  await expect(messageInput(page)).toBeVisible();

  expect(hygiene.consoleErrors).toEqual([]);
});
