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

/**
 * Send a user prompt and wait for an interrupt to surface.
 *
 * Unlike `sendPromptAndWait`, this helper does NOT wait for the
 * Stop-generating cycle to complete with the agent fully idle. When an
 * interrupt fires, the agent transitions to idle while the
 * `chat-interrupt-panel` is still showing — the panel locator is the
 * durable signal that the run has paused.
 *
 * Pair with `clickInterruptActionAndWaitFinal` to drive the resume.
 */
export async function sendPromptAndWaitForInterrupt(
  page: Page,
  prompt: string,
  opts?: SendPromptAndWaitOptions,
): Promise<void> {
  const path = opts?.path ?? '/';
  await page.goto(path);
  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill(prompt);
  await page.getByRole('button', { name: /send/i }).click();

  // Brief — typically <1s. Catches the case where the click didn't dispatch.
  await expect(page.getByRole('button', { name: /stop generating/i })).toBeVisible({
    timeout: 10_000,
  });

  // Panel visible implies the run paused at an interrupt rather than completing.
  await expect(page.locator('chat-interrupt-panel')).toBeVisible({ timeout: 60_000 });
}

/**
 * Click an action button on the visible chat-interrupt-panel and wait
 * for the resume continuation to finalize.
 *
 * Returns the last finalized assistant bubble (same return shape as
 * `sendPromptAndWait`), so callers can text-match the post-resume
 * response.
 *
 * Label is matched exactly (anchored regex). The library composition
 * emits 'accept' | 'edit' | 'respond' | 'ignore' as host outputs; the
 * actual button text is 'Accept' / 'Edit' / 'Respond' / 'Ignore'.
 */
export async function clickInterruptActionAndWaitFinal(
  page: Page,
  label: 'Accept' | 'Edit' | 'Respond' | 'Ignore',
): Promise<Locator> {
  const button = page
    .locator('chat-interrupt-panel')
    .getByRole('button', { name: new RegExp(`^${label}$`) });
  await button.click();

  // Resume re-enters loading.
  await expect(page.getByRole('button', { name: /stop generating/i })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole('button', { name: /stop generating/i })).not.toBeAttached({
    timeout: 60_000,
  });

  const finalizedAssistant = page
    .locator('chat-message[data-role="assistant"][data-streaming="false"]')
    .last();
  await expect(finalizedAssistant).toBeAttached({ timeout: 5_000 });
  return finalizedAssistant;
}

/**
 * Send a user prompt and wait for the final assistant bubble to render.
 *
 * Unlike `sendPromptAndWait` (which polls for the "Stop generating" button
 * visibility), this waits directly on the durable end-state:
 * `chat-message[data-role="assistant"][data-streaming="false"]`.
 *
 * Use this helper for caps where the streaming pass is too fast for Playwright
 * to observe an intermediate loading state — typically aimock-backed e2es
 * where the SSE chunks arrive in <100ms. The "Stop generating" button is
 * conditionally rendered (`@if (isLoading() && canStop())`), and signal-
 * batched updates can collapse the visible state below Playwright's polling
 * resolution.
 *
 * Compatible with all cap shapes — composed `<chat>` AND raw primitive
 * components — because the assertion is on the rendered `chat-message`
 * element's data attributes, not on input/button affordances.
 */
export async function submitAndWaitForResponse(
  page: Page,
  prompt: string,
  opts?: { path?: string; timeoutMs?: number },
): Promise<Locator> {
  const path = opts?.path ?? '/';
  const timeoutMs = opts?.timeoutMs ?? 30_000;
  await page.goto(path);
  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill(prompt);
  await page.getByRole('button', { name: /send message/i }).click();
  const finalAssistant = page
    .locator('chat-message[data-role="assistant"][data-streaming="false"]')
    .last();
  await expect(finalAssistant).toBeAttached({ timeout: timeoutMs });
  return finalAssistant;
}
