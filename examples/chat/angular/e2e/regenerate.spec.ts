// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { sendPromptAndWait } from './test-helpers';

test('regenerate: re-running keeps 1 user / 1 assistant in the conversation', async ({
  page,
}) => {
  // Reuse the smoke 'say hi briefly' fixture — aimock returns the same
  // response on regenerate; the invariant we care about is the count.
  await sendPromptAndWait(page, 'say hi briefly');

  const userMessages = page.locator('chat-message[data-role="user"]');
  const assistantMessages = page.locator('chat-message[data-role="assistant"]');
  await expect(userMessages).toHaveCount(1);
  await expect(assistantMessages).toHaveCount(1);

  // Click Regenerate on the assistant message (aria-label is the durable hook).
  await page.getByRole('button', { name: 'Regenerate response' }).first().click();

  // Wait for the regenerated assistant turn to finalize (data-streaming flips
  // back to true then false). We can't reuse sendPromptAndWait here because
  // there's no fresh prompt to send — instead poll until exactly one
  // finalized assistant is present and the count holds at 1/1.
  await expect
    .poll(
      async () =>
        page
          .locator('chat-message[data-role="assistant"][data-streaming="false"]')
          .count(),
      { timeout: 45_000 },
    )
    .toBeGreaterThan(0);

  // Single-turn invariant: after regenerate, conversation stays at 1u/1a
  // (the assistant message is replaced in place, not appended).
  await expect(userMessages).toHaveCount(1);
  await expect(assistantMessages).toHaveCount(1);

  const threadId = await page.evaluate(() => {
    const raw = localStorage.getItem('ngaf-chat-demo:palette');
    return raw ? (JSON.parse(raw) as { threadId?: string }).threadId : undefined;
  });
  expect(threadId).toBeTruthy();
  const state = await fetch(`http://localhost:2024/threads/${threadId}/state`).then((r) =>
    r.json() as Promise<{ values?: { messages?: unknown[] }; next?: unknown[] }>,
  );
  expect(state.values?.messages).toHaveLength(2);
  expect(state.next ?? []).toEqual([]);
});

test('regenerate: repeated regenerate keeps the same 1 user / 1 assistant shape', async ({
  page,
}) => {
  await sendPromptAndWait(page, 'say hi briefly');

  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Regenerate response' }).first().click();
    await expect
      .poll(
        async () =>
          page
            .locator('chat-message[data-role="assistant"][data-streaming="false"]')
            .count(),
        { timeout: 45_000 },
      )
      .toBeGreaterThan(0);
    await expect(page.locator('chat-message[data-role="user"]')).toHaveCount(1);
    await expect(page.locator('chat-message[data-role="assistant"]')).toHaveCount(1);
  }
});
