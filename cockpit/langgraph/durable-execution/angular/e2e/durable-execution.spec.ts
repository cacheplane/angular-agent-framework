// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '../../../../../libs/e2e-harness/src';

test('durable-execution: hello prompt produces assistant turn', async ({ page }) => {
  const bubble = await submitAndWaitForResponse(page, 'Hello');
  // Smoke: backend booted, aimock replayed fixture, assistant bubble
  // finalized (data-streaming="false") and is present in the DOM.
  await expect(bubble).toBeVisible();
});
