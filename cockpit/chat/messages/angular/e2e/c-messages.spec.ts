// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '@threadplane-internal/e2e-harness';

const PROMPT = 'Hello';

test('c-messages: user message and AI response both render', async ({ page }) => {
  const bubble = await submitAndWaitForResponse(page, PROMPT);

  await expect(
    page.locator('chat-message[data-role="user"]').last(),
  ).toContainText(PROMPT);

  await expect(bubble).toContainText('chat-messages capability demo');
});

test('c-messages: chat-message-list renders both turns', async ({ page }) => {
  await submitAndWaitForResponse(page, PROMPT);

  // Post-PR-#466 the demo projects user + assistant templates, so the
  // list renders one bubble per message. Regression coverage for that fix.
  await expect(page.locator('chat-message-list chat-message')).toHaveCount(2);
});

test('c-messages: a code fence streamed in 3-char chunks renders as a code block', async ({ page }) => {
  const bubble = await submitAndWaitForResponse(page, 'Stream a TypeScript code fence');

  // Final-state invariant driven through REAL small-chunk streaming: the
  // fence opener arrives split mid-token and must still commit as a block.
  await expect(bubble.locator('pre code')).toHaveCount(1);
  await expect(bubble.locator('pre code')).toContainText('const answer = 42;');
  await expect(bubble).not.toContainText('```');
});
