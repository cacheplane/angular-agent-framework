// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '@threadplane-internal/e2e-harness';

test('json-render: dashboard renders with STATE_SNAPSHOT-bound KPI values', async ({ page }) => {
  await submitAndWaitForResponse(page, 'Show me a dashboard of airline operations.');
  // Spec content mounts the GenUI tree; the KPI numbers arrive via
  // STATE_SNAPSHOT (graph state → agent.state() → render store).
  await expect(page.locator('chat-generative-ui').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('chat-generative-ui')).not.toHaveCount(0);
  // At least one stat card shows a non-skeleton value (proves the data path).
  await expect(page.locator('app-stat-card .stat-card__value').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('app-stat-card .stat-card__value').first()).not.toBeEmpty();
});
