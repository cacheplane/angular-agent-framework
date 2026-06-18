// SPDX-License-Identifier: MIT
import { test, expect, type Page } from '@playwright/test';
import { openDemo, waitForFinalAssistant } from './test-helpers';

// Distinctive child-research sentence the subagent's final answer streams. It
// must be unique enough that finding it in the parent's assistant bubble is a
// real leak, not a coincidental substring of the orchestrator's final answer
// (which deliberately paraphrases instead of quoting this verbatim).
const CHILD_SENTENCE = 'foundation for zoneless Angular';

interface SubagentProbe {
  size: number;
  entries: {
    name?: string;
    status?: string;
    messageCount: number;
    messageTexts: string[];
    toolCalls: { name?: string; result?: string }[];
  }[];
}

// Reads the live `agent.subagents()` projection off the shell component via
// Angular's dev-mode global. The chat-subagents primitive renders a
// <chat-subagent-card> for each subagent whose status is pending/running, and
// the card binds the ORDERED transcript: `messages()` (the assistant turn(s)
// the child streamed, each carrying `toolCallIds`/reasoning) and `toolCalls()`
// (the child's own `lookup` calls, rendered as <chat-tool-call-card>). Under
// the aimock harness the run settles near-instantly (started → finished within
// one SSE flush), so the card transits the RUNNING state below a render frame
// and is filtered out of the DOM by the time the assistant turn finalizes —
// exactly the reason the cockpit subagents spec (and the original card spec)
// asserts on durable signals rather than the card element. We read the
// projected map directly: it IS the data the card renders, and it proves the
// ACTIVITY snapshot/delta pipeline reconstructed the full reason→tool→answer
// transcript and that it settled to `complete`.
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
        toolCalls?: () => { name?: string; result?: string }[];
      };
      const messages = sa.messages?.() ?? [];
      const toolCalls = sa.toolCalls?.() ?? [];
      out.entries.push({
        name: sa.name,
        status: sa.status?.(),
        messageCount: messages.length,
        messageTexts: messages.map((m) => (typeof m.content === 'string' ? m.content : '')),
        toolCalls: toolCalls.map((tc) => ({ name: tc.name, result: tc.result })),
      });
    });
    return out;
  });
}

// Research delegation over the AG-UI transport: the parent LLM calls the
// `research` tool, the langgraph child subgraph runs a genuine reason → tool →
// answer loop (an LLM call that returns a `lookup` tool_call, the offline
// `lookup` tool, then a second plain LLM call that writes the summary), and the
// ag-ui server converts the subagent_activity CUSTOM events into native
// ACTIVITY_SNAPSHOT/ACTIVITY_DELTA. The @threadplane/ag-ui reducer projects the
// activity to agent.subagents() (the ordered transcript chat-subagent-card
// renders) and the child's research text must stay OUT of the parent's bubble.
test('research delegation reconstructs the multi-message subagent transcript', async ({
  page,
}) => {
  await openDemo(page);

  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill('Research Angular signals and summarize');
  await page.getByRole('button', { name: /send/i }).click();

  // The orchestrator dispatched the research subagent — its tool-call card is a
  // durable DOM signal (renders the tool name verbatim), unlike the
  // active-only subagent card.
  const researchCall = page
    .locator('chat-tool-call-card')
    .filter({ hasText: /research/i });
  await expect(researchCall.first()).toBeVisible({ timeout: 30_000 });

  // Wait for the parent turn to finalize so the full run (delegation + child
  // reason/tool/answer loop + settle) has played out.
  const bubble = await waitForFinalAssistant(page);

  // The live subagent-card data path populated and settled: agent.subagents()
  // carries the research subagent, now `complete`. Poll until it reaches
  // `complete` to avoid CI micro-races where signal propagation hasn't settled
  // at the moment of the first read.
  await expect
    .poll(
      async () => {
        const subs = await readSubagents(page);
        const research = subs.entries.find((e) => e.name === 'research');
        return research?.status ?? null;
      },
      { timeout: 15_000 }
    )
    .toBe('complete');

  const subs = await readSubagents(page);
  expect(subs.size).toBeGreaterThan(0);
  const research = subs.entries.find((e) => e.name === 'research');
  expect(research, 'a research subagent should be projected').toBeTruthy();

  // Transcript shape: the reason→tool→answer loop produces at least TWO
  // assistant turns — the tool-calling turn (which carries the `lookup`
  // tool_call) and the final answer turn. This is the ordered transcript the
  // <chat-subagent-card> renders one `.sac__msg` per message.
  expect(
    research!.messageCount,
    'subagent transcript should surface the tool-call turn plus the answer turn'
  ).toBeGreaterThanOrEqual(2);

  // At least one subagent tool call — the `lookup` call the child made — is
  // projected with its name and (offline, canned) result. This is what each
  // <chat-tool-call-card> inside the subagent card binds to.
  expect(
    research!.toolCalls.length,
    'subagent should surface its lookup tool call'
  ).toBeGreaterThanOrEqual(1);
  const lookup = research!.toolCalls.find((tc) => tc.name === 'lookup');
  expect(lookup, 'the lookup tool call should be projected by name').toBeTruthy();
  expect(lookup!.result, 'the lookup tool call should carry its canned result').toContain(
    'reactivity primitive'
  );

  // The streamed final answer is part of the transcript.
  expect(research!.messageTexts.join('\n')).toContain(CHILD_SENTENCE);

  // The child research text must NOT leak into the parent's rendered markdown
  // surface. Target chat-streaming-md (the assistant's answer) rather than the
  // whole chat-message, which nests the per-message subagent card host.
  const mainMarkdown = bubble.locator('chat-streaming-md').first();
  await expect(mainMarkdown).toBeVisible();
  await expect(mainMarkdown).not.toContainText(CHILD_SENTENCE);
});
