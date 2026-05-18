// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import {
  attachBrowserHygiene,
  messageInput,
  openDemo,
  sendButton,
  toolbarSelect,
} from './test-helpers';

test('initial render: root route redirects to welcome-state embed mode', async ({
  page,
}) => {
  await openDemo(page, '/');
  const hygiene = attachBrowserHygiene(page);

  await expect(page).toHaveURL(/\/embed$/);
  await expect(
    page.getByRole('heading', { name: 'How can I help?' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Demo: render a contact form/i })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'More prompts' })
  ).toBeVisible();
  await expect(messageInput(page)).toBeVisible();
  await expect(sendButton(page)).toBeDisabled();

  await expect(
    page.locator('.demo-shell__segmented-button.is-active', {
      hasText: 'Embed',
    })
  ).toBeVisible();
  await expect(toolbarSelect(page, 'Model')).toHaveText(/gpt-5-mini/);
  await expect(
    page.getByRole('button', { name: 'Open chat devtools' })
  ).toBeVisible();

  expect(hygiene.consoleErrors).toEqual([]);
  expect(hygiene.failedRequests).toEqual([]);
});

test('initial render: unknown route redirects back to embed', async ({
  page,
}) => {
  await openDemo(page, '/definitely-not-a-mode');
  await expect(page).toHaveURL(/\/embed$/);
  await expect(page.locator('embed-mode chat')).toBeVisible();
});
