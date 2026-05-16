// SPDX-License-Identifier: MIT
import { expect, type Locator, type Page } from '@playwright/test';

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
export async function sendPromptAndWait(page: Page, prompt: string): Promise<Locator> {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill(prompt);
  await page.getByRole('button', { name: /send/i }).click();

  const finalizedAssistant = page
    .locator('chat-message[data-role="assistant"][data-streaming="false"]')
    .last();
  await expect(finalizedAssistant).toBeAttached({ timeout: 45_000 });
  await expect
    .poll(async () => ((await finalizedAssistant.innerText()) ?? '').trim().length, {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  return finalizedAssistant;
}
