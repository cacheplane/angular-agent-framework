// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '@ngaf-internal/e2e-harness';

const PROMPT = 'Plan a trip from LAX to JFK';

test('c-subagents: orchestrator dispatches task subagents, summary surfaces in bubble', async ({
  page,
}) => {
  const bubble = await submitAndWaitForResponse(page, PROMPT);

  // The chat-tool-calls primitive renders a collapsible button labeled
  // "Called task N times" for the orchestrator's task dispatches. Asserting
  // it's in the DOM proves the orchestrator emitted real task tool_calls.
  //
  // We don't assert on <chat-subagent-card> because that primitive only
  // renders while a subagent is in a RUNNING state — once all subagents
  // complete (which is the state submitAndWaitForResponse returns at, since the
  // agent is idle), the cards are filtered out of the DOM. The tool-call
  // chip is the durable signal.
  const taskChip = page.getByRole('button', { name: /called task|task/i }).first();
  await expect(taskChip).toBeVisible({ timeout: 30_000 });

  // Final summary text contains an aviation-related phrase from the captured
  // continuation. Loose regex so refactors to the subagent prompts (research/
  // booking/itinerary outputs) don't break the test.
  const finalText = await bubble.innerText();
  expect(finalText.toLowerCase()).toMatch(/lax|jfk|itinerary|trip|flight/);
});
