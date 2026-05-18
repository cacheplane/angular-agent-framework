// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import {
  messageInput,
  openDemo,
  sendButton,
  selectToolbarOption,
  toolbarSelect,
  waitForFinalAssistant,
} from './test-helpers';

test('model picker: configured models render, persist, and reach backend state', async ({
  page,
}) => {
  await openDemo(page, '/embed');

  const modelTrigger = toolbarSelect(page, 'Model');
  // Open the chat-select menu and assert the three model options are listed.
  await modelTrigger.click();
  const modelMenu = page
    .locator('.demo-shell__field')
    .filter({ hasText: 'Model' })
    .locator('chat-select .chat-select__menu');
  await expect(modelMenu.locator('.chat-select__option')).toHaveText([
    'gpt-5',
    'gpt-5-mini',
    'gpt-5-nano',
  ]);
  // Close the menu (click trigger again) before continuing.
  await modelTrigger.click();

  await selectToolbarOption(page, 'Model', 'gpt-5-nano');
  await expect(modelTrigger).toHaveText(/gpt-5-nano/);

  await page.reload();
  await expect(toolbarSelect(page, 'Model')).toHaveText(/gpt-5-nano/);

  await page
    .locator('.demo-shell__segmented-button', { hasText: 'Popup' })
    .click();
  await expect(page).toHaveURL(/\/popup$/);
  await expect(toolbarSelect(page, 'Model')).toHaveText(/gpt-5-nano/);

  await page.goto('/embed');
  await messageInput(page).fill('say hi briefly');
  await sendButton(page).click();
  await waitForFinalAssistant(page);

  const threadId = await page.evaluate(() => {
    const raw = localStorage.getItem('ngaf-chat-demo:palette');
    return raw
      ? (JSON.parse(raw) as { threadId?: string }).threadId
      : undefined;
  });
  expect(threadId).toBeTruthy();
  const state = await fetch(
    `http://localhost:2024/threads/${threadId}/state`
  ).then((r) => r.json() as Promise<{ values?: { model?: string } }>);
  expect(state.values?.model).toBe('gpt-5-nano');
});
