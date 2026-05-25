// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '@threadplane-internal/e2e-harness';

const PROMPT = 'Hello';

test('c-theming: AI response renders in composed chat surface', async ({ page }) => {
  const bubble = await submitAndWaitForResponse(page, PROMPT);
  await expect(bubble).toContainText('chat-theming demo');
});

test('c-theming: theme picker buttons are present in sidebar', async ({ page }) => {
  await page.goto('/');
  // Distinctive surface — four theme-picker buttons that set CSS custom
  // properties on document.documentElement.
  for (const label of ['Dark', 'Light', 'Ocean', 'Forest']) {
    await expect(page.getByRole('button', { name: label })).toBeVisible();
  }
});
