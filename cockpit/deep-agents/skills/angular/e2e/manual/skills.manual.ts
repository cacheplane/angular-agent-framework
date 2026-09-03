//
// Live-model manual check. Not run by CI (playwright matches *.spec.ts only).
//   npx nx run cockpit:serve-skills
//   npx playwright test cockpit/deep-agents/skills/angular/e2e/manual
import { expect, test } from '@playwright/test';

test.describe('Deep Agents Skills Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4314');
    await page.waitForSelector('app-skills', { state: 'attached' });
  });

  test('renders the chat interface with an empty skill index', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('textarea[name="messageText"]')).toBeVisible();
    await expect(page.locator('text=No skills loaded')).toBeVisible();
  });

  test('opens only the skill the request matches', async ({ page }) => {
    await page.getByRole('button', { name: 'Mid-size jet at KASE' }).click();

    await expect(page.locator('[data-testid="skill"]')).toHaveCount(2, { timeout: 120000 });
    await expect(
      page.locator('[data-testid="skill"][data-name="runway-analysis"]'),
    ).toHaveAttribute('data-opened', 'true', { timeout: 120000 });
    await expect(page.locator('[data-testid="skill-open"]').first()).toBeVisible();
  });
});
