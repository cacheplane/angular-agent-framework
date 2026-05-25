// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '@threadplane-internal/e2e-harness';

test('deployment-runtime: hello prompt produces assistant turn', async ({ page }) => {
  const bubble = await submitAndWaitForResponse(page, 'Hello');
  // Smoke: backend booted, aimock replayed fixture, assistant bubble
  // finalized (data-streaming="false") and is present in the DOM.
  await expect(bubble).toBeVisible();
});
