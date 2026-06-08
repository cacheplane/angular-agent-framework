// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { attachBrowserHygiene, messageInput, sendButton } from './test-helpers';

// The ag-ui example is a single-route chat (no demo-shell modes/toolbar). This
// asserts the app mounts cleanly over the AG-UI transport: the chat composition
// renders, the composer is present and starts disabled (empty input), and the
// page loads with no console errors or failed requests.
test('initial render: the ag-ui chat app loads with a usable composer', async ({
  page,
}) => {
  const hygiene = attachBrowserHygiene(page);
  await page.goto('/');

  await expect(page.locator('chat')).toBeVisible();
  await expect(messageInput(page)).toBeVisible();
  await expect(sendButton(page)).toBeDisabled();

  expect(hygiene.consoleErrors).toEqual([]);
  expect(hygiene.failedRequests).toEqual([]);
});
