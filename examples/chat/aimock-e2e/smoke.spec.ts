// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';

test('hi: assistant bubble renders non-empty text from the replayed fixture', async ({ page }) => {
  await page.goto('/embed');

  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill('say hi briefly');
  await page.getByRole('button', { name: /send/i }).click();

  // Wait for the assistant bubble to appear.
  const assistantBubble = page.locator('chat-message').filter({ hasNotText: 'say hi briefly' }).last();
  await expect(assistantBubble).toBeVisible({ timeout: 30_000 });

  // Wait for streaming to settle: bubble must contain non-whitespace text.
  await expect.poll(
    async () => ((await assistantBubble.innerText()) ?? '').trim().length,
    { timeout: 30_000 },
  ).toBeGreaterThan(0);

  const finalText = await assistantBubble.innerText();
  expect(finalText.trim()).toMatch(/hi/i);
});
