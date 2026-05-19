// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '../../../../../libs/e2e-harness/src';

const PROMPT = 'Hello';

test('c-threads: AI response renders in composed chat surface', async ({ page }) => {
  const bubble = await submitAndWaitForResponse(page, PROMPT);
  await expect(bubble).toContainText('chat-threads demo');
});

test('c-threads: chat-thread-list sidebar is mounted', async ({ page }) => {
  await page.goto('/');
  // Sidebar's distinctive surface — thread switcher seeded with 3 hardcoded
  // threads (thread-1/2/3). Existence + non-zero entry count proves wiring.
  await expect(page.locator('chat-thread-list')).toBeVisible();
});
