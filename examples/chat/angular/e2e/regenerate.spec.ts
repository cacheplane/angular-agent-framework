// SPDX-License-Identifier: MIT
import { test, expect, type Page } from '@playwright/test';
import { activeThreadIdFromUrl, sendPromptAndWait } from './test-helpers';

async function regenerateAndWait(page: Page): Promise<void> {
  const assistantMessages = page.locator(
    'chat-message[data-role="assistant"]',
  );
  await expect(assistantMessages).toHaveCount(1);

  // Keep a handle to the exact finalized response that existed before the
  // click. A locator alone could silently resolve to that response and let the
  // terminal-state assertion pass before regeneration has started.
  const originalAssistant = await assistantMessages.elementHandle();
  if (!originalAssistant) {
    throw new Error('Expected a finalized assistant response before regenerate');
  }

  await page.getByRole('button', { name: 'Regenerate response' }).click();

  // Regenerate truncates the old assistant before streaming its replacement.
  // Requiring the original DOM node to disconnect ties the wait to this click,
  // even when aimock completes too quickly to sample data-streaming="true".
  await expect
    .poll(
      () => originalAssistant.evaluate((element) => element.isConnected),
      { timeout: 45_000 },
    )
    .toBe(false);

  const regeneratedAssistant = page.locator(
    'chat-message[data-role="assistant"][data-streaming="false"]',
  );
  await expect(regeneratedAssistant).toHaveCount(1, { timeout: 45_000 });
  await expect
    .poll(async () => (await regeneratedAssistant.innerText()).trim().length, {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);

  await expect(page.locator('chat-message[data-role="user"]')).toHaveCount(1);
  await expect(assistantMessages).toHaveCount(1);
}

test('regenerate: re-running keeps 1 user / 1 assistant in the conversation', async ({
  page,
}) => {
  // Reuse the smoke 'say hi briefly' fixture — aimock returns the same
  // response on regenerate, so DOM replacement proves a new run occurred.
  await sendPromptAndWait(page, 'say hi briefly');

  const userMessages = page.locator('chat-message[data-role="user"]');
  const assistantMessages = page.locator('chat-message[data-role="assistant"]');
  await expect(userMessages).toHaveCount(1);
  await expect(assistantMessages).toHaveCount(1);

  await regenerateAndWait(page);

  const threadId = await activeThreadIdFromUrl(page);
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
    await regenerateAndWait(page);
  }
});
