// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import {
  activeThreadIdFromUrl,
  messageInput,
  openDemo,
  sendButton,
  waitForFinalAssistant,
} from './test-helpers';

test('url routing: deep-link with thread id loads that thread', async ({ page }) => {
  // Bootstrap: create a thread by sending one message.
  await openDemo(page, '/embed');
  await messageInput(page).fill('say hi briefly');
  await sendButton(page).click();
  await waitForFinalAssistant(page);

  await expect(page).toHaveURL(/\/embed\/[A-Za-z0-9-]+$/);
  const threadId = await activeThreadIdFromUrl(page);
  expect(threadId).toBeTruthy();

  // Reload via direct navigation to /embed/<id> — assert the existing
  // assistant message renders without resending the prompt.
  await page.goto(`/embed/${threadId}`);
  await expect(page.locator('chat-message[data-role="assistant"]')).toContainText(/hi/i, {
    timeout: 30_000,
  });
});

test('url routing: deep-link with knob param sets the picker', async ({ page }) => {
  await openDemo(page, '/embed?model=gpt-5-nano');

  // The model toolbar trigger surfaces the current model. Confirm the URL
  // value won, not the default.
  const modelTrigger = page.locator('.demo-shell__field[data-field="model"] .chat-select__trigger');
  await expect(modelTrigger).toContainText('gpt-5-nano');
});

test('url routing: mode switch preserves thread + knob params', async ({ page }) => {
  // Bootstrap: thread + non-default knob.
  await openDemo(page, '/embed');
  await messageInput(page).fill('say hi briefly');
  await sendButton(page).click();
  await waitForFinalAssistant(page);
  const threadId = await activeThreadIdFromUrl(page);
  expect(threadId).toBeTruthy();

  // Set a non-default model via the toolbar.
  const modelTrigger = page.locator('.demo-shell__field[data-field="model"] .chat-select__trigger');
  await modelTrigger.click();
  await page.locator('.chat-select__option', { hasText: 'gpt-5-nano' }).first().click();
  await expect(page).toHaveURL(/[?&]model=gpt-5-nano/);

  // Click Popup mode in the segmented control.
  await page.locator('.demo-shell__segmented-button', { hasText: 'Popup' }).click();

  // URL holds both thread + knob param.
  await expect(page).toHaveURL(new RegExp(`/popup/${threadId}(\\?|\\?.*&)model=gpt-5-nano`));
});

test('url routing: ephemeral hydration does not write to localStorage', async ({ page }) => {
  // Visit with a non-default theme in the URL.
  await openDemo(page, '/embed?theme=material-dark');

  // openDemo clears localStorage before the test starts; assert it's
  // still clean (no `theme: 'material-dark'` written by hydration).
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('threadplane-chat-demo:palette');
    return raw ? (JSON.parse(raw) as { theme?: string }).theme : null;
  });
  expect(stored).toBeNull();
});
