// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '@ngaf-internal/e2e-harness';

const PROMPT = 'Hello';

test('c-timeline: AI response renders in composed chat surface', async ({ page }) => {
  const bubble = await submitAndWaitForResponse(page, PROMPT);
  await expect(bubble).toContainText('chat-timeline demo');
});

test('c-timeline: chat-timeline-slider sidebar is mounted', async ({ page }) => {
  await page.goto('/');
  // Distinctive surface — slider reflects checkpoint state.
  await expect(page.locator('chat-timeline-slider')).toBeVisible();
});
