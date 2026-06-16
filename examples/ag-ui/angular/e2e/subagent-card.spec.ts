// SPDX-License-Identifier: MIT
import { test, expect, type Page } from '@playwright/test';
import { openDemo, waitForFinalAssistant } from './test-helpers';

// Distinctive child-research sentence the subagent streams. It must be unique
// enough that finding it in the parent's assistant bubble is a real leak, not a
// coincidental substring of the orchestrator's final answer (which deliberately
// paraphrases instead of quoting this verbatim).
const CHILD_SENTENCE = 'The Louvre opened in 1793 and holds about 35,000 works.';

interface SubagentProbe {
  size: number;
  entries: { name?: string; status?: string; text?: string }[];
}

// Reads the live `agent.subagents()` projection off the shell component via
// Angular's dev-mode global. The chat-subagents primitive renders a
// <chat-subagent-card> for each subagent whose status is pending/running, so
// the map IS the data the card binds to. Under the aimock harness the run
// settles near-instantly (started → finished within one SSE flush), so the
// card transits the RUNNING state below a render frame and is filtered out of
// the DOM by the time the assistant turn finalizes — exactly the reason the
// cockpit subagents spec asserts on durable signals rather than the card
// element. We read the projected map directly: it proves the ACTIVITY
// snapshot/delta pipeline populated the subagent (name + streamed child text)
// and that it settled to `complete`.
async function readSubagents(page: Page): Promise<SubagentProbe> {
  return page.evaluate(() => {
    const ng = (window as unknown as { ng?: { getComponent?: (el: Element) => unknown } }).ng;
    const el = document.querySelector('ag-ui-shell');
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

// Research delegation over the AG-UI transport: the parent LLM calls the
// `research` tool, the langgraph child subgraph streams a summary, and the
// ag-ui server converts the subagent_activity CUSTOM events into native
// ACTIVITY_SNAPSHOT/ACTIVITY_DELTA. The @threadplane/ag-ui reducer projects the
// activity to agent.subagents() (what chat-subagents renders as a live card)
// and the child's research text must stay OUT of the parent's bubble.
test('research delegation renders a live subagent card that settles complete', async ({
  page,
}) => {
  await openDemo(page);

  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill('Research the Louvre and summarize');
  await page.getByRole('button', { name: /send/i }).click();

  // The orchestrator dispatched the research subagent — its tool-call card is a
  // durable DOM signal (renders the tool name verbatim), unlike the
  // active-only subagent card.
  const researchCall = page
    .locator('chat-tool-call-card')
    .filter({ hasText: /research/i });
  await expect(researchCall.first()).toBeVisible({ timeout: 30_000 });

  // Wait for the parent turn to finalize so the full run (delegation + child
  // stream + settle) has played out.
  const bubble = await waitForFinalAssistant(page);

  // The live subagent-card data path populated and settled: agent.subagents()
  // carries the research subagent with its streamed child summary, now
  // `complete`. This is the exact projection chat-subagents binds the card to.
  const probe = await readSubagents(page);
  expect(probe.size).toBeGreaterThan(0);
  const research = probe.entries.find((e) => e.name === 'research');
  expect(research, 'a research subagent should be projected').toBeTruthy();
  expect(research?.text).toContain(CHILD_SENTENCE);
  expect(research?.status).toBe('complete');

  // The child research text must NOT leak into the parent's rendered markdown
  // surface. Target chat-streaming-md (the assistant's answer) rather than the
  // whole chat-message, which nests the per-message subagent card host.
  const mainMarkdown = bubble.locator('chat-streaming-md').last();
  await expect(mainMarkdown).toBeVisible();
  await expect(mainMarkdown).not.toContainText(CHILD_SENTENCE);
});
