// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { messageInput, openDemo, sendButton, waitForFinalAssistant } from './test-helpers';

test('error handling: failed stream surfaces an alert and the next send recovers', async ({
  page,
}) => {
  // The LangGraph SDK retries a failed stream connect with exponential backoff
  // (~15s) before surfacing the error — fine for production resilience, too slow
  // to assert here. Opt this app instance into fail-fast (0 connect retries) so
  // the alert appears promptly. Set before bootstrap via addInitScript.
  await page.addInitScript(() => {
    localStorage.setItem('THREADPLANE_E2E_MAX_RETRIES', '0');
  });

  await openDemo(page, '/embed');

  await page.route('**/runs/stream', async (route) => {
    await route.abort('failed');
  });

  await messageInput(page).fill('say hi briefly');
  await sendButton(page).click();
  await expect(page.getByRole('alert')).toContainText(/fail|error/i, { timeout: 15_000 });

  await page.unroute('**/runs/stream');
  await expect(messageInput(page)).toBeEnabled();
  await messageInput(page).fill('say hi briefly');
  await sendButton(page).click();
  const bubble = await waitForFinalAssistant(page);
  await expect(bubble).toContainText(/hi/i);
});
