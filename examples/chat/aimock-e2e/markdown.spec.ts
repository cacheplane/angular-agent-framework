// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { sendPromptAndWait } from './test-helpers';

test('heading: assistant bubble renders an <h1>', async ({ page }) => {
  const bubble = await sendPromptAndWait(page, 'respond with a heading');
  await expect(bubble.locator('h1')).toBeVisible();
  await expect(bubble.locator('h1')).toContainText(/heading one/i);
});

test('code fence: assistant bubble renders <pre><code>', async ({ page }) => {
  const bubble = await sendPromptAndWait(page, 'respond with a code fence');
  const codeBlock = bubble.locator('pre code');
  await expect(codeBlock).toBeVisible();
  await expect(codeBlock).toContainText('const answer = 42');
});

test('bullet list: assistant bubble renders <ul> with three <li>', async ({ page }) => {
  const bubble = await sendPromptAndWait(page, 'respond with a bullet list');
  const list = bubble.locator('ul');
  await expect(list).toBeVisible();
  await expect(list.locator('li')).toHaveCount(3);
  await expect(list.locator('li').nth(0)).toContainText('alpha');
  await expect(list.locator('li').nth(1)).toContainText('beta');
  await expect(list.locator('li').nth(2)).toContainText('gamma');
});
