// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '@threadplane-internal/e2e-harness';

test('c-a2ui: LAX-JFK prompt renders a2ui-surface with form spec', async ({ page }) => {
  await submitAndWaitForResponse(page, 'I want to fly LAX to JFK');

  // The BookingFormSpec tool call returns an A2UI form spec which the
  // chat-lib content-classifier mounts as a <a2ui-surface> with the
  // booking surface_id. Presence proves the envelope parsed and the
  // A2UI host wired up against the cap's catalog views.
  await expect(page.locator('a2ui-surface')).toBeVisible();
});

test('c-a2ui: SFO-SEA prompt also renders a2ui-surface', async ({ page }) => {
  await submitAndWaitForResponse(page, 'I want to fly SFO to SEA');
  await expect(page.locator('a2ui-surface')).toBeVisible();
});
