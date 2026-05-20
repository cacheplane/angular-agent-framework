// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '../../../../../libs/e2e-harness/src';

test('da-sandboxes: hello prompt produces assistant turn', async ({ page }) => {
  const bubble = await submitAndWaitForResponse(page, 'Hello');
  await expect(bubble).toBeVisible();
});
