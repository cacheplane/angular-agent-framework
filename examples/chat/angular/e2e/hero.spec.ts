import { test, expect } from '@playwright/test';
import { attachBrowserHygiene } from './test-helpers';

test.describe('hero walkthrough', () => {
  // The replay is a real live stream now (hundreds of token events per run),
  // so one full pass runs well past Playwright's 30s default.
  test.describe.configure({ timeout: 120_000 });
  test('replays to the interrupt, takes over to live, and can replay again', async ({ page }) => {
    const hygiene = attachBrowserHygiene(page);
    await page.goto('/hero');
    const pill = page.locator('[data-hero-pill]');
    await expect(pill).toContainText(/recorded LangGraph run/i);
    // The script types and sends; the replayed run pauses on the interrupt.
    await expect(page.locator('hero-cursor')).toHaveAttribute('data-visible', 'true', {
      timeout: 15_000,
    });
    await expect(page.locator('chat-interrupt-panel')).toBeAttached({ timeout: 60_000 });
    // Takeover via the pill.
    await page.getByRole('button', { name: /take control/i }).click();
    await expect(pill).toContainText(/Live · LangGraph/);
    await expect(page.locator('[data-hero-banner]')).toContainText(/walkthrough was a recording/i);
    await expect(page.locator('hero-cursor')).toHaveAttribute('data-visible', 'false');
    // Back to replay.
    await page.getByRole('button', { name: /replay walkthrough/i }).click();
    await expect(pill).toContainText(/recorded LangGraph run/i);
    expect(hygiene.consoleErrors).toEqual([]);
  });

  test('the full walkthrough reaches the generated UI without taking control of itself', async ({
    page,
  }) => {
    const hygiene = attachBrowserHygiene(page);
    await page.goto('/hero');
    const pill = page.locator('[data-hero-pill]');
    await expect(page.locator('chat-interrupt-panel')).toBeAttached({ timeout: 60_000 });
    // The pause comes from delete_backups, after list_backups has rendered its
    // registered tool view — the inventory the visitor is being asked about.
    await expect(page.locator('app-backup-table [data-state="rows"]')).toBeAttached();
    // Accept is pressed by the script; the A2UI surface from run 3 renders.
    await expect(page.locator('a2ui-surface').first()).toBeAttached({ timeout: 90_000 });
    await expect(pill).toContainText(/recorded LangGraph run/i);
    expect(hygiene.consoleErrors).toEqual([]);
  });

  test('focusing the composer takes over', async ({ page }) => {
    const hygiene = attachBrowserHygiene(page);
    await page.goto('/hero');
    await page.locator('[data-hero-surface] textarea').focus();
    await expect(page.locator('[data-hero-pill]')).toContainText(/Live · LangGraph/);
    expect(hygiene.consoleErrors).toEqual([]);
  });
});
