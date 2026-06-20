// SPDX-License-Identifier: MIT
import { test, expect, type Page } from '@playwright/test';
import { submitAndWaitForResponse } from '@threadplane-internal/e2e-harness';

const PROMPT = 'Plan a trip from LAX to JFK';

// Distinctive sentence the research subagent streams. It must be unique enough
// that finding it in the parent's assistant bubble would be a real leak, not a
// coincidental substring of the orchestrator's final answer (which deliberately
// paraphrases instead of quoting this verbatim).
const RESEARCH_SENTENCE =
  'LAX sprawls across nine terminals while JFK runs six under the AirTrain loop.';

interface SubagentProbe {
  size: number;
  entries: { name?: string; status?: string; text?: string }[];
}

// Reads the live `agent.subagents()` projection off the cockpit host component
// via Angular's dev-mode global. The spawning `task` tool call now renders
// inline AS a <chat-subagent-card> anchored to its message, and the card
// PERSISTS (collapsed) after the subagent completes — there is no separate
// active-only mount, and the `task` call no longer renders a generic tool-call
// chip. The map read here is the data the card binds to: it proves the ACTIVITY
// snapshot/delta pipeline populated the subagent (name + streamed child text)
// and that it settled to `complete`. The card element and this projection are
// asserted together below (card presence/persistence + projection contents).
async function readSubagents(page: Page): Promise<SubagentProbe> {
  return page.evaluate(() => {
    const ng = (window as unknown as { ng?: { getComponent?: (el: Element) => unknown } }).ng;
    const el = document.querySelector('app-subagents');
    const out: SubagentProbe = { size: 0, entries: [] };
    if (!ng?.getComponent || !el) return out;
    const cmp = ng.getComponent(el) as { agent?: { subagents?: () => Map<string, unknown> } };
    const map = cmp?.agent?.subagents?.();
    if (!map) return out;
    out.size = map.size;
    map.forEach((s) => {
      const sa = s as {
        name?: string;
        status?: () => string;
        messages?: () => { content?: string }[];
      };
      out.entries.push({
        name: sa.name,
        status: sa.status?.(),
        text: sa.messages?.()[0]?.content,
      });
    });
    return out;
  });
}

// Research delegation over the AG-UI transport: the orchestrator LLM calls the
// `task` tool, the subagent LLM streams a summary, and the ag-ui server
// converts the subagent_activity CUSTOM events into native ACTIVITY_SNAPSHOT/
// ACTIVITY_DELTA. The @threadplane/ag-ui reducer projects the activity to
// agent.subagents(), which the inline <chat-subagent-card> (rendered in place of
// the `task` tool call) binds to. The child's research text must stay OUT of the
// parent's bubble.
test('ag-ui subagents: orchestrator dispatches subagent cards that settle complete', async ({
  page,
}) => {
  const bubble = await submitAndWaitForResponse(page, PROMPT);

  // The spawning `task` tool call renders inline AS a <chat-subagent-card>
  // (replacing the generic tool-call chip), anchored to its message. Asserting
  // the card is in the DOM proves the orchestrator emitted a real task dispatch
  // and that it surfaced as the dedicated subagent card.
  await expect(page.locator('chat-subagent-card').first()).toBeVisible({ timeout: 30_000 });

  // The live subagent-card data path populated and settled: agent.subagents()
  // carries the research subagent with its streamed child summary, now
  // `complete`. This is the exact projection the inline card binds to. Poll
  // until the research subagent reaches `complete` to avoid CI micro-races where
  // signal propagation hasn't settled at the moment of the first read.
  await expect
    .poll(
      async () => {
        const subs = await readSubagents(page);
        const research = subs.entries.find((e) => e.name === 'research');
        return research?.status ?? null;
      },
      { timeout: 15_000 },
    )
    .toBe('complete');

  // The card PERSISTS after completion (collapsed) — there is no active-only
  // mount, so it must still be present once the run has settled.
  await expect(page.locator('chat-subagent-card').first()).toBeVisible();

  const subs = await readSubagents(page);
  expect(subs.size).toBeGreaterThan(0);

  // No duplicate cards: exactly one <chat-subagent-card> per projected subagent.
  // Under aimock the orchestrator may dispatch 1+ subagents; assert equality to
  // the projected size rather than a hardcoded count.
  expect(await page.locator('chat-subagent-card').count()).toBe(subs.size);

  const research = subs.entries.find((e) => e.name === 'research');
  expect(research, 'a research subagent should be projected').toBeTruthy();
  expect(research?.text).toContain(RESEARCH_SENTENCE);

  // The child research text must NOT leak into the parent's rendered markdown
  // surface. Target chat-streaming-md (the assistant's answer) rather than the
  // whole chat-message, which nests the per-message subagent card host.
  const mainMarkdown = bubble.locator('chat-streaming-md').first();
  await expect(mainMarkdown).toBeVisible();
  await expect(mainMarkdown).not.toContainText(RESEARCH_SENTENCE);

  // The final orchestrator summary still surfaces in the bubble.
  const finalText = await bubble.innerText();
  expect(finalText.toLowerCase()).toMatch(/lax|jfk|itinerary|trip|flight/);
});
