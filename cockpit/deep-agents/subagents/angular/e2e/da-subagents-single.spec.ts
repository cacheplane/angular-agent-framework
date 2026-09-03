import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '@threadplane-internal/e2e-harness';

// Matches the welcome suggestion in subagents.component.ts and the fixture in
// e2e/fixtures/da-subagents-single.json.
const PROMPT = 'What is the field data for KSFO?';

test('da-subagents: a single dispatch renders one card with the child transcript', async ({
  page,
}) => {
  const bubble = await submitAndWaitForResponse(page, PROMPT);

  // One `task` call, one child graph, one persistent card. The card is the
  // proof that `subagentToolNames: ['task']` is wired: without it the same
  // dispatch renders as a generic tool chip.
  await expect(page.locator('chat-subagent-card')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByTestId('dispatch-count')).toHaveText('1 dispatched, 0 running');

  // The card is labelled with the `subagent_type` the orchestrator chose, and
  // expanding it shows the child's own transcript with the numbers it looked up.
  const card = page.locator('chat-subagent-card').first();
  await expect(card.locator('.sac__name')).toHaveText('field-researcher');
  await card.getByRole('button', { expanded: false }).first().click();
  await expect(card).toContainText(/11,?870|elevation/i);

  const finalText = await bubble.innerText();
  expect(finalText.toLowerCase()).toContain('ksfo');
});
