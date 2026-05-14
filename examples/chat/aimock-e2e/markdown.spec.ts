// SPDX-License-Identifier: MIT
import { test, expect, type Locator } from '@playwright/test';

async function sendPrompt(page: Awaited<ReturnType<typeof import('@playwright/test').test.step>> extends never ? never : Parameters<Parameters<typeof test>[1]>[0]['page'], prompt: string): Promise<Locator> {
  await page.goto('/embed');
  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill(prompt);
  await page.getByRole('button', { name: /send/i }).click();

  const assistantBubble = page.locator('chat-message').filter({ hasNotText: prompt }).last();
  await expect(assistantBubble).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => ((await assistantBubble.innerText()) ?? '').trim().length, { timeout: 30_000 })
    .toBeGreaterThan(0);
  return assistantBubble;
}

test('heading: assistant bubble renders an <h1>', async ({ page }) => {
  const bubble = await sendPrompt(page, 'respond with a heading');
  await expect(bubble.locator('h1')).toBeVisible();
  await expect(bubble.locator('h1')).toContainText(/heading one/i);
});

test('code fence: assistant bubble renders <pre><code>', async ({ page }) => {
  const bubble = await sendPrompt(page, 'respond with a code fence');
  const codeBlock = bubble.locator('pre code');
  await expect(codeBlock).toBeVisible();
  await expect(codeBlock).toContainText('const answer = 42');
});

test('bullet list: assistant bubble renders <ul> with three <li>', async ({ page }) => {
  const bubble = await sendPrompt(page, 'respond with a bullet list');
  const list = bubble.locator('ul');
  await expect(list).toBeVisible();
  await expect(list.locator('li')).toHaveCount(3);
  await expect(list.locator('li').nth(0)).toContainText('alpha');
  await expect(list.locator('li').nth(1)).toContainText('beta');
  await expect(list.locator('li').nth(2)).toContainText('gamma');
});
