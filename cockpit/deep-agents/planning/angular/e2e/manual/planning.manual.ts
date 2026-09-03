//
// Live-model manual check. Not run by CI (playwright matches *.spec.ts only).
//   npx nx run cockpit:serve-planning
//   npx playwright test cockpit/deep-agents/planning/angular/e2e/manual
import { expect, test } from '@playwright/test';

test.describe('Deep Agents Planning Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4310');
    await page.waitForSelector('app-planning', { state: 'attached' });
  });

  test('renders the chat interface with an empty plan panel', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('textarea[name="messageText"]')).toBeVisible();
    await expect(page.locator('text=No plan yet')).toBeVisible();
  });

  test('writes a todo list and works it to completion', async ({ page }) => {
    await page.getByRole('button', { name: 'Dispatch brief: KSFO to KASE' }).click();

    const rows = page.locator('[data-testid="todo-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 60000 });
    await expect(page.locator('[data-testid="todo-row"][data-status="completed"]').first()).toBeVisible({
      timeout: 120000,
    });
    await expect(page.locator('[data-testid="todo-progress"]')).toBeVisible();
  });
});
