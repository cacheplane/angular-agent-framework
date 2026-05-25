// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import {
  attachBrowserHygiene,
  openDemo,
  selectToolbarOption,
} from './test-helpers';

test('color scheme: dark default, light toggle persists and syncs default A2UI theme', async ({
  page,
}) => {
  await openDemo(page, '/embed');
  const hygiene = attachBrowserHygiene(page);

  await expect(page.locator('html')).toHaveAttribute(
    'data-color-scheme',
    'dark'
  );
  await expect(page.locator('html')).toHaveAttribute(
    'data-threadplane-chat-theme',
    'dark'
  );
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    'default-dark'
  );

  await page.getByRole('button', { name: 'Switch to light theme' }).click();

  await expect(page.locator('html')).toHaveAttribute(
    'data-color-scheme',
    'light'
  );
  await expect(page.locator('html')).toHaveAttribute(
    'data-threadplane-chat-theme',
    'light'
  );
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    'default-light'
  );

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute(
    'data-color-scheme',
    'light'
  );
  await expect(page.locator('html')).toHaveAttribute(
    'data-threadplane-chat-theme',
    'light'
  );

  expect(hygiene.consoleErrors).toEqual([]);
});

test('color scheme: material A2UI theme override wins over scheme sync', async ({
  page,
}) => {
  await openDemo(page, '/embed');

  await selectToolbarOption(page, 'Theme', 'Material dark');
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    'material-dark'
  );

  await page.getByRole('button', { name: 'Switch to light theme' }).click();

  await expect(page.locator('html')).toHaveAttribute(
    'data-color-scheme',
    'light'
  );
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    'material-dark'
  );
});
