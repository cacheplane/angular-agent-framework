import { test, expect, type Page } from '@playwright/test';
import { submitAndWaitForResponse } from '@threadplane-internal/e2e-harness';

const PROMPT = 'What is a jet bridge?';

/**
 * The checkpoint rows the c-debug pipeline writes, newest first.
 *
 * Every label is structural, not model prose: `toDebugCheckpoint` reads
 * `state.next[0]` off each LangGraph checkpoint, so the list is exactly the
 * graph's wiring (`__start__` → generate → process → summarize →
 * generate_title) read backwards, plus the terminal checkpoint whose `next`
 * is empty and therefore falls back to the positional `Step 1` label.
 *
 * Asserting the whole list rather than a count is deliberate. The row set IS
 * what this capability exists to demonstrate, so a node added to or dropped
 * from the pipeline should fail here and be re-stated, not silently pass.
 */
const EXPECTED_CHECKPOINT_ROWS = [
  'Step 1',
  'generate_title',
  'summarize',
  'process',
  'generate',
  '__start__',
];

const openDock = (page: Page) =>
  page.getByRole('button', { name: /open chat devtools/i }).click();

test('c-debug: the Timeline tab shows its empty state before any run', async ({ page }) => {
  await page.goto('/');
  await openDock(page);

  // The dock opens on the Timeline tab. With no run on the thread there is
  // nothing to inspect, and this is the state the demo was stuck in for as
  // long as it mounted <chat-debug> with no composer beside it.
  await expect(page.locator('chat-debug-timeline-inspector')).toBeVisible();
  await expect(page.getByText('No checkpoints yet.')).toBeVisible();
  await expect(page.locator('chat-debug-checkpoint-card')).toHaveCount(0);
});

test('c-debug: a run through the composer fills the Timeline tab', async ({ page }) => {
  // Sending through <chat>'s composer is the whole point of the pairing:
  // the chat produces the run, the dock inspects it.
  await submitAndWaitForResponse(page, PROMPT);
  await openDock(page);

  const cards = page.locator('chat-debug-checkpoint-card');
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  await expect(cards).toHaveCount(EXPECTED_CHECKPOINT_ROWS.length);
  expect((await cards.allTextContents()).map((t) => t.trim())).toEqual(
    EXPECTED_CHECKPOINT_ROWS,
  );
  await expect(page.getByText('No checkpoints yet.')).toHaveCount(0);
});

test('c-debug: selecting a checkpoint diffs that step of the run', async ({ page }) => {
  await submitAndWaitForResponse(page, PROMPT);
  await openDock(page);

  const cards = page.locator('chat-debug-checkpoint-card');
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  await cards.first().click();

  // The newest checkpoint has no predecessor in the list, so its diff is the
  // whole of that checkpoint's values added at once. `messages` is the only
  // key on this graph's MessagesState, and it is read from the checkpoint the
  // server persisted — so a diff naming it proves the panel is rendering real
  // run state rather than a placeholder.
  const diff = page.locator('chat-debug-state-diff');
  await expect(diff).toBeVisible();
  await expect(diff).toContainText('+ messages');
});

test('c-debug: the State tab swaps in the live state inspector', async ({ page }) => {
  await submitAndWaitForResponse(page, PROMPT);
  await openDock(page);
  await expect(page.locator('chat-debug-checkpoint-card').first()).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole('tab', { name: 'State' }).click();

  const stateTab = page.locator('chat-debug-state-tab');
  await expect(stateTab).toBeVisible();
  await expect(stateTab).toContainText('Current state');
  // The tab owns the panel body — the timeline is torn down, not stacked.
  await expect(page.locator('chat-debug-checkpoint-card')).toHaveCount(0);
  // `agent.state()` is the LangGraph values bag with `messages` projected out
  // into the transcript, so on this MessagesState graph the inspector renders
  // an empty object today. Assert the shape the JsonPipe produces rather than
  // that exact literal: the claim is that the inspector is mounted and bound
  // to the agent, and a graph that carries state beyond its messages should
  // widen this tab's coverage, not fail it.
  await expect(stateTab.locator('chat-debug-state-inspector pre')).toHaveText(
    /^\{[\s\S]*\}$/,
  );
});
