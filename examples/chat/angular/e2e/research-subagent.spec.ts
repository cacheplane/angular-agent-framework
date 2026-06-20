// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { openDemo } from './test-helpers';

const PROMPT =
  'Use the research subagent to investigate the history and motivation behind ' +
  'Angular standalone components, then report back with a concise summary.';

test('research subagent: parent dispatches research, subagent content surfaces in the bubble', async ({
  page,
}) => {
  await openDemo(page, '/embed');

  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill(PROMPT);
  await page.getByRole('button', { name: /send/i }).click();

  // The `research` tool call (a subagent dispatch via subagentToolNames) renders
  // inline AS a <chat-subagent-card> — agent.subagents() populates from the
  // research subgraph's tools:<id> namespace. The card PERSISTS (collapsed)
  // after the subagent completes, so it is stable to assert at idle.
  await expect(page.locator('chat-subagent-card').first()).toBeVisible({ timeout: 45_000 });

  // The captured subagent summary mentions standalone components and NgModule.
  // Assert one of those terms appears in the conversation body — proves the
  // subagent's LLM response made it through the graph back into the chat.
  const conversation = page.locator('chat-message-list, chat-window').first();
  await expect.poll(
    async () => (await conversation.innerText()).toLowerCase(),
    { timeout: 45_000 },
  ).toMatch(/standalone components|ngmodule/i);
});
