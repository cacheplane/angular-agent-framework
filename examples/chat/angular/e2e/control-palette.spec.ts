// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import {
  openChatDevtools,
  openDemo,
  selectToolbarOption,
  toolbarSelect,
} from './test-helpers';

test('control palette: toolbar renders defaults and persists selected controls', async ({
  page,
}) => {
  await openDemo(page, '/embed');

  await expect(
    page.getByRole('toolbar', { name: 'Demo controls' })
  ).toBeVisible();
  await expect(
    page.locator('.demo-shell__segmented-button.is-active', {
      hasText: 'Embed',
    })
  ).toBeVisible();
  await expect(toolbarSelect(page, 'Model')).toHaveValue('gpt-5-mini');
  await expect(toolbarSelect(page, 'Effort')).toHaveValue('minimal');
  await expect(toolbarSelect(page, 'Gen UI')).toHaveValue('a2ui');
  await expect(toolbarSelect(page, 'Theme')).toHaveValue('default-dark');

  await selectToolbarOption(page, 'Model', 'gpt-5-nano');
  await selectToolbarOption(page, 'Effort', 'low');
  await selectToolbarOption(page, 'Gen UI', 'json-render');
  await selectToolbarOption(page, 'Theme', 'Material dark');

  await page.reload();
  await expect(toolbarSelect(page, 'Model')).toHaveValue('gpt-5-nano');
  await expect(toolbarSelect(page, 'Effort')).toHaveValue('low');
  await expect(toolbarSelect(page, 'Gen UI')).toHaveValue('json-render');
  await expect(toolbarSelect(page, 'Theme')).toHaveValue('material-dark');
});

test('control palette: devtools opens on demand and closes back to launcher', async ({
  page,
}) => {
  await openDemo(page, '/embed');

  await openChatDevtools(page);
  await expect(
    page.getByRole('region', { name: 'Chat devtools' })
  ).toBeVisible();
  await expect(page.locator('.panel.panel--right')).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('chat-debug .panel')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Open chat devtools' })
  ).toBeVisible();
});

test('control palette: mode segmented control changes routes', async ({
  page,
}) => {
  await openDemo(page, '/embed');
  await page
    .locator('.demo-shell__segmented-button', { hasText: 'Sidebar' })
    .click();
  await expect(page).toHaveURL(/\/sidebar$/);
  await expect(
    page.locator('.demo-shell__segmented-button.is-active', {
      hasText: 'Sidebar',
    })
  ).toBeVisible();
});
