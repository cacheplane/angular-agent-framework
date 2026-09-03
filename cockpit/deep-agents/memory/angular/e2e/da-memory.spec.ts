import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '@threadplane-internal/e2e-harness';

// Match the welcome suggestions in memory.component.ts and the fixture in
// e2e/fixtures/da-memory.json.
const TEACH =
  'I fly a Citation CJ3 out of KASE, and I always want briefings in bullet points. Please remember that.';
const RECALL = 'What do you already know about my operation?';

test('da-memory: the agent writes its memory file and a new thread still has it', async ({
  page,
}) => {
  // First conversation: the agent edits /memories/AGENTS.md itself. Nothing in
  // this app parses the conversation for facts.
  await submitAndWaitForResponse(page, TEACH);

  // `submitAndWaitForResponse` navigates, so this second call runs on a FRESH
  // page load and therefore a fresh thread. The memory file is not on the
  // thread — StoreBackend put it in the LangGraph store — so this asserts
  // cross-thread persistence, not that the panel remembers its own DOM.
  await submitAndWaitForResponse(page, RECALL);

  // The panel only fills in because the graph republishes `memory_contents` as
  // a custom stream event. The key is PrivateStateAttr, so it never reaches the
  // `values` stream and a panel bound to agent.value() alone would be empty
  // during the run.
  const file = page.locator('[data-testid="memory-file"][data-path="/memories/AGENTS.md"]');
  await expect(file).toBeVisible({ timeout: 30_000 });

  // The contents are what the agent wrote in the FIRST conversation.
  await expect(file).toContainText('Citation CJ3');
  await expect(file).toContainText('KASE');
  await expect(file).toContainText(/bullet points/i);
  await expect(page.getByTestId('memory-line').first()).toContainText('Crew notes');

  // The panel is showing the LIVE source, which only exists because the graph
  // republishes `memory_contents` as a custom stream event. Without that
  // middleware the panel still fills in, but only from the settle-time
  // checkpoint hydration — so this assertion is what keeps the live path
  // honest.
  await expect(page.getByTestId('memory-source')).toHaveAttribute('data-source', 'live');
});
