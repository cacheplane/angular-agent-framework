// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '@threadplane-internal/e2e-harness';

test('json-render: render spec mounts and the STATE_SNAPSHOT-bound value renders', async ({ page }) => {
  await submitAndWaitForResponse(page, 'Show me a dashboard.');
  // The render_spec content mounts <chat-generative-ui>; the /demo/value
  // binding (42) arrives via STATE_SNAPSHOT → agent.state() → render store.
  const card = page.locator('app-stat-card');
  await expect(card.first()).toBeVisible({ timeout: 30000 });
  await expect(card.first()).toContainText('42');
});
