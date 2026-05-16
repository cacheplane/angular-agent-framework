// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { sendPromptAndWait } from './test-helpers';

test('hi: assistant bubble renders non-empty text from the replayed fixture', async ({ page }) => {
  const bubble = await sendPromptAndWait(page, 'say hi briefly');
  const finalText = await bubble.innerText();
  expect(finalText.trim()).toMatch(/hi/i);
});
