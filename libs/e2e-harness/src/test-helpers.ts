// SPDX-License-Identifier: MIT
import { expect, type Locator, type Page } from '@playwright/test';

export interface SendPromptAndWaitOptions {
  /** Route to navigate to before sending the prompt. Default: '/'. */
  path?: string;
}

/**
 * Send a user prompt and wait for the assistant bubble to finalize.
 *
 * "Finalized" means `chat-message[data-role="assistant"][data-streaming="false"]`:
 * the chat composition wires `[streaming]` to `agent.isLoading() && i === lastIndex`
 * on the latest assistant `<chat-message>`, so the attribute flips to `"false"`
 * once the agent stops loading and the markdown render has settled.
 *
 * Asserting on intermediate streaming-state DOM (partial `<ul>`, in-flight
 * code fences, etc.) is the source of e2e flake — always wait on this
 * attribute before counting or text-matching downstream of the assistant turn.
 */
export async function sendPromptAndWait(
  page: Page,
  prompt: string,
  opts?: SendPromptAndWaitOptions,
): Promise<Locator> {
  const path = opts?.path ?? '/';
  await page.goto(path);
  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill(prompt);
  // Capture the send button BEFORE click — same node will flip to "Stop
  // generating" while loading, then back to "Send" when the agent finishes
  // ALL turns (tool calls + continuations included).
  const sendButton = page.getByRole('button', { name: /send/i });
  await sendButton.click();

  // Wait for the agent to enter the loading state (Stop generating visible).
  // Brief — typically <1s. Catches the case where the click didn't dispatch.
  await expect(page.getByRole('button', { name: /stop generating/i })).toBeVisible({
    timeout: 10_000,
  });

  // Now wait for the agent to fully finish: Stop generating gone, Send back.
  // This is the durable agent-level idle signal — survives multi-turn flows
  // (tool_call → tool_result → continuation). Per-message data-streaming
  // flips multiple times during a single turn and races with .last().
  await expect(page.getByRole('button', { name: /stop generating/i })).not.toBeAttached({
    timeout: 60_000,
  });

  // Return the last finalized assistant bubble — guaranteed to be the
  // FINAL message in the turn now that the agent is fully idle.
  const finalizedAssistant = page
    .locator('chat-message[data-role="assistant"][data-streaming="false"]')
    .last();
  await expect(finalizedAssistant).toBeAttached({ timeout: 5_000 });
  return finalizedAssistant;
}
