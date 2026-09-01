// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';

// Second proof outside unit tests that the neutral Agent contract's
// interrupt path works against a genuinely non-LangGraph AG-UI backend: the
// AWS Strands bridge signals interrupts via the protocol-standard
// RUN_FINISHED outcome (never CUSTOM on_interrupt), and resume goes out as
// the top-level `resume` entry array keyed by interruptId.
test.describe('cockpit runtimes/aws-strands: meeting booking approval', () => {
  test('approval card displays the pending book_meeting call', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Book the Q3 roadmap review').click();
    const dialog = page.locator('dialog.chat-approval-card');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toContainText('Booking approval required');
    await expect(dialog).toContainText('Q3 roadmap review');
    await expect(dialog).toContainText('Tuesday 10:00');
  });

  test('shared state panel snapshots availability and the pending booking', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Book the Q3 roadmap review').click();
    const panel = page.getByTestId('schedule-state');
    // From check_availability's state_from_result snapshot.
    await expect(panel).toContainText('Tuesday', { timeout: 30_000 });
    await expect(panel).toContainText('10:00');
    // From book_meeting's state_from_args snapshot (fires before the interrupt).
    await expect(panel.getByTestId('booking-state')).toContainText('pending', { timeout: 30_000 });
  });

  test('Approve resumes the run and the meeting is booked', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Book the Q3 roadmap review').click();
    const dialog = page.locator('dialog.chat-approval-card');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await dialog.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText(/is booked for Tuesday 10:00/i)).toBeVisible({ timeout: 30_000 });
  });
});
