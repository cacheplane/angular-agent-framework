// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '@ngaf-internal/e2e-harness';

const PROMPT = 'Hello';

test('c-input: user message and AI response both render', async ({ page }) => {
  const bubble = await submitAndWaitForResponse(page, PROMPT);

  await expect(
    page.locator('chat-message[data-role="user"]').last(),
  ).toContainText(PROMPT);

  await expect(bubble).toContainText('chat-input demo');
});

test('c-input: chat-message-list renders both turns', async ({ page }) => {
  await submitAndWaitForResponse(page, PROMPT);

  // c-input uses raw ChatMessageListComponent primitives with projected
  // templates (per PR #466's fix). Regression coverage for that fix.
  await expect(page.locator('chat-message-list chat-message')).toHaveCount(2);
});
