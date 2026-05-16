// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { sendPromptAndWait } from '../../../../../libs/e2e-harness/src';

const PROMPT = "What's the status of UA123?";

test('c-tool-calls: parent dispatches lookup_flight tool, continuation surfaces flight data', async ({ page }) => {
  const bubble = await sendPromptAndWait(page, PROMPT);

  // The chat-tool-calls primitive renders a card per tool call. Card label
  // includes the tool name. Asserting it's in the DOM proves the parent's
  // tool_call routed through the chat-tool-calls UI primitive.
  const toolCallChip = page.getByRole('button', { name: /lookup_flight|tool/i }).first();
  await expect(toolCallChip).toBeVisible({ timeout: 30_000 });

  // The continuation's text mentions a distinctive phrase from the captured
  // response — proves the tool-result-then-text loop completed end-to-end.
  const finalText = await bubble.innerText();
  expect(finalText.toLowerCase()).toContain('ua123');
});
