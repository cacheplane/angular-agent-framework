// SPDX-License-Identifier: MIT
//
// Testing strategy for the helpers in this file:
//
// These helpers orchestrate Playwright `Page` APIs — `goto`, `getByRole`,
// `locator`, `click`, `expect.toBeAttached/toBeVisible`. Unit-testing them
// with a mock Page would mostly verify our wiring of Playwright's API, not
// real behavior.
//
// Authoritative behavioral coverage lives in the cockpit cap aimock e2es
// (24 specs across cockpit/{chat,langgraph,deep-agents}/*/angular/e2e/),
// each of which exercises one of these helpers against a real Playwright
// page driving the cap's UI through aimock-replayed responses. If any of
// these helpers regress, the matrix lights up red across many caps.
//
// `aimock-runner.spec.ts` (in this same directory) covers `startAimock`
// directly — it's the only helper testable without a real Page.
import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Send a user prompt and wait for an interrupt to surface.
 *
 * Unlike `submitAndWaitForResponse`, this helper does NOT wait for the
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
  opts?: { path?: string },
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
 * `submitAndWaitForResponse`), so callers can text-match the post-resume
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
 * Unlike `sendPromptAndWaitForInterrupt` (which polls for the "Stop generating" button
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
