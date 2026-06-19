// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { messageInput, openDemo, sendButton, waitForFinalAssistant } from './test-helpers';

test('error handling: failed stream surfaces an alert and the next send recovers', async ({
  page,
}) => {
  await openDemo(page, '/');

  await page.route('**/agent', async (route) => {
    await route.abort('failed');
  });

  await messageInput(page).fill('say hi briefly');
  await sendButton(page).click();
  await expect(page.getByRole('alert')).toContainText(
    /can't reach|connection|server|interrupted|try again/i,
    { timeout: 15_000 },
  );

  await page.unroute('**/agent');
  await expect(messageInput(page)).toBeEnabled();
  await messageInput(page).fill('say hi briefly');
  await sendButton(page).click();
  const bubble = await waitForFinalAssistant(page);
  await expect(bubble).toContainText(/hi/i);
});
