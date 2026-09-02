// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '@threadplane-internal/e2e-harness';

// First cockpit e2e whose backend is neither LangGraph nor Python: the
// rt-mastra topic runs against the deployments/ag-ui-mastra Node service
// (Mastra agents behind the hand-written AG-UI SSE endpoint). Interrupts
// surface as CUSTOM on_interrupt (Mastra-shaped payload with toolCallId +
// runId) plus the protocol-standard RUN_FINISHED outcome, and resume rides
// forwardedProps.command.interruptEvent — the adapter path shipped in
// #888/#889/#891, proven live here for the first time.
test.describe('cockpit runtimes/mastra: camping trip planner', () => {
  test('backend tool result streams into the reply', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Check trail conditions').click();
    await expect(page.getByText(/Clear skies at Yosemite Valley/i)).toBeVisible({ timeout: 30_000 });
  });

  test('working memory streams into the shared-state panel', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Start a packing list').click();
    const panel = page.getByTestId('packing-state');
    await expect(panel).toContainText('Yosemite Weekend', { timeout: 30_000 });
    await expect(panel).toContainText('tent');
    await expect(panel).toContainText('sleeping bag');
    await expect(page.getByText(/packing list is ready/i)).toBeVisible({ timeout: 30_000 });
  });

  test('suspended reserve_campsite shows the approval card', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Reserve the campsite').click();
    const dialog = page.locator('dialog.chat-approval-card');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toContainText('Reservation approval required');
    await expect(dialog).toContainText('North Pines');
    await expect(dialog).toContainText('$90.00');
  });

  test('Approve resumes the suspended run and the reservation completes', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Reserve the campsite').click();
    const dialog = page.locator('dialog.chat-approval-card');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await dialog.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText(/reserved for 2 nights/i)).toBeVisible({ timeout: 30_000 });
  });

  // Delegation: the supervisor calls the registered weather_forecaster
  // sub-agent (wire tool `agent-weather_forecaster`); the server-side
  // emitter (deployments/ag-ui-mastra/subagent-emitter.mjs) injects
  // SUBAGENT_STARTED + attributed TEXT_MESSAGE_* + SUBAGENT_FINISHED, which
  // the adapter reduces into a subagent card on the tool-call group.
  test('rt-mastra: delegated forecast renders a subagent card with the final text', async ({ page }) => {
    const bubble = await submitAndWaitForResponse(page, 'Plan a trip to Bear Lake this weekend — what will the weather be?');
    await expect(page.locator('chat-subagent-card')).toHaveCount(1);
    await expect(page.locator('chat-subagent-card')).toContainText('weather_forecaster');
    await expect(bubble).toContainText(/forecast|weather/i);
  });
});
