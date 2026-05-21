// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '@ngaf-internal/e2e-harness';

test('da-memory: hello prompt produces assistant turn', async ({ page }) => {
  const bubble = await submitAndWaitForResponse(page, 'Hello');
  await expect(bubble).toBeVisible();
});
