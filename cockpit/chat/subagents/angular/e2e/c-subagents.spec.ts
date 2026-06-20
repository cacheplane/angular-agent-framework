// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '@threadplane-internal/e2e-harness';

const PROMPT = 'Plan a trip from LAX to JFK';

test('c-subagents: orchestrator dispatches task subagents, summary surfaces in bubble', async ({
  page,
}) => {
  const bubble = await submitAndWaitForResponse(page, PROMPT);

  // The orchestrator dispatches `task` subagents, each a real LangGraph
  // subgraph. With subagentToolNames:['task'] the SubagentTracker registers
  // them (from the subagent_type arg) and matches the child subgraph's
  // tools:<id> namespace, so agent.subagents() populates and each dispatch
  // renders inline AS a <chat-subagent-card> (replacing the generic chip).
  // The card PERSISTS after completion (collapsed), so it's stable to assert
  // even though submitAndWaitForResponse returns at idle.
  await expect(page.locator('chat-subagent-card').first()).toBeVisible({ timeout: 30_000 });

  // One card per subagent dispatched (research/booking/itinerary), no
  // duplicates — the orchestrator calls task three times in order.
  await expect(page.locator('chat-subagent-card')).toHaveCount(3);

  // Final summary text contains an aviation-related phrase from the captured
  // continuation. Loose regex so refactors to the subagent prompts (research/
  // booking/itinerary outputs) don't break the test.
  const finalText = await bubble.innerText();
  expect(finalText.toLowerCase()).toMatch(/lax|jfk|itinerary|trip|flight/);
});
