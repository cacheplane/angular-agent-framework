// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';

// First proof outside unit tests that the neutral Agent contract's interrupt
// path works against a genuinely non-LangGraph AG-UI backend: the Microsoft
// Agent Framework bridge signals interrupts via the protocol-standard
// RUN_FINISHED outcome (never CUSTOM on_interrupt), and resume goes out as
// the top-level `resume` entry array.
test.describe('cockpit runtimes/microsoft-agent-framework: expense approval', () => {
  test('approval card displays the pending submit_expense call', async ({ page }) => {
    await page.goto('/');
    await page.getByText('File a team dinner expense').click();
    const dialog = page.locator('dialog.chat-approval-card');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toContainText('Expense approval required');
    await expect(dialog).toContainText('Blue Finch Bistro');
    await expect(dialog).toContainText('meals');
  });

  test('shared state panel mirrors the drafted expense', async ({ page }) => {
    await page.goto('/');
    await page.getByText('File a team dinner expense').click();
    const panel = page.getByTestId('expense-state');
    await expect(panel).toContainText('Blue Finch Bistro', { timeout: 30_000 });
    await expect(panel).toContainText('$220.00');
  });

  test('Approve resumes the run and the expense is submitted', async ({ page }) => {
    await page.goto('/');
    await page.getByText('File a team dinner expense').click();
    const dialog = page.locator('dialog.chat-approval-card');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await dialog.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText(/has been submitted for reimbursement/i)).toBeVisible({ timeout: 30_000 });
  });
});
