// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { sendPromptAndWait } from '../../../../../libs/internal/aimock-harness/src';

test('streaming: assistant text from the mocked LLM renders in the cockpit chat composition', async ({ page }) => {
  const bubble = await sendPromptAndWait(
    page,
    'Tell me one quick fact about Angular signals in two sentences.',
  );

  // The captured fixture's content (Angular signals fact) must reach the
  // rendered bubble. Proves: aimock served the streaming graph's LLM call,
  // langgraph routed back the AI message, the cockpit-langgraph-streaming-angular
  // app rendered it via the chat composition, and the streaming-finalized
  // signal (data-streaming="false") settled.
  const finalText = await bubble.innerText();
  expect(finalText.toLowerCase()).toContain('signal');
});
