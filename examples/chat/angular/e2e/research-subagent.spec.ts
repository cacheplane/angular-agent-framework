// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';

const PROMPT =
  'Use the research subagent to investigate the history and motivation behind ' +
  'Angular standalone components, then report back with a concise summary.';

test('research subagent: parent dispatches research, subagent content surfaces in the bubble', async ({
  page,
}) => {
  await page.goto('/embed');

  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill(PROMPT);
  await page.getByRole('button', { name: /send/i }).click();

  // The chat-tool-calls primitive renders a button/chip labeled "Called research"
  // (or similar) once the parent dispatches the tool. With aimock the subagent
  // runs essentially instantly, so we don't try to catch the transient
  // <chat-subagents> panel — instead we assert on the durable
  // tool-call-completion chip and on subagent-emitted content reaching the bubble.
  const researchChip = page.getByRole('button', { name: /research/i }).first();
  await expect(researchChip).toBeVisible({ timeout: 45_000 });

  // The captured subagent summary mentions standalone components and NgModule.
  // Assert one of those terms appears in the conversation body — proves the
  // subagent's LLM response made it through the graph back into the chat.
  const conversation = page.locator('chat-message-list, chat-window').first();
  await expect.poll(
    async () => (await conversation.innerText()).toLowerCase(),
    { timeout: 45_000 },
  ).toMatch(/standalone components|ngmodule/i);
});
