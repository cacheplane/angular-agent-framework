import { test, expect, type Page } from '@playwright/test';
import { attachBrowserHygiene } from './test-helpers';
import type { StageState } from '../src/app/stage/stage-bridge';
import type { StageTimeline } from '../src/app/stage/stage-timeline';

// Mirrors the augmentation in stage-mode.component.ts, which the e2e tsconfig does not pull in.
declare global {
  interface Window {
    __stageTimeline?: StageTimeline;
    __stageApplied?: StageState;
  }
}

/**
 * The /stage route replays the committed `public/stage-replay.json` beside the
 * real devtools, seekable by `?t=<ms>`. The page publishes its timeline on
 * `window.__stageTimeline` once the replay is ready, so the specs read the
 * beat boundaries from the recording rather than hard-coding milliseconds
 * that would drift on the next re-record.
 */
async function timeline(page: Page): Promise<StageTimeline> {
  await page.goto('/stage?t=0');
  await expect
    .poll(() => page.evaluate(() => !!window.__stageTimeline), { timeout: 30_000 })
    .toBe(true);
  return page.evaluate(() => window.__stageTimeline as StageTimeline);
}

test.describe('stage replay', () => {
  test.describe.configure({ timeout: 120_000 });

  test('renders the chat beside the devtools and seeks to the approve hold', async ({ page }) => {
    const hygiene = attachBrowserHygiene(page);
    const tl = await timeline(page);
    await expect(page.getByRole('region', { name: 'Chat devtools' })).toBeVisible();
    await page.goto(`/stage?t=${tl.hold.startMs + 1}`);
    await expect(page.locator('chat-interrupt-panel')).toBeAttached({ timeout: 60_000 });
    // The pause comes from delete_backups, after list_backups has rendered its
    // registered tool view — the inventory the visitor is being asked about.
    await expect(page.locator('app-backup-table [data-state="rows"]')).toBeAttached();
    // Replay is a recording, not a control surface: the panel shows but cannot
    // be clicked, so a visitor cannot desync the transcript from t.
    expect(
      await page
        .locator('[data-stage-interrupt]')
        .evaluate((el) => getComputedStyle(el).pointerEvents),
    ).toBe('none');
    expect(hygiene.consoleErrors).toEqual([]);
  });

  test('the end of the recording mounts the generated form and the devtools shows the thread', async ({
    page,
  }) => {
    const hygiene = attachBrowserHygiene(page);
    const tl = await timeline(page);
    await page.goto(`/stage?t=${tl.totalMs}`);
    await expect(page.locator('a2ui-surface').first()).toBeAttached({ timeout: 90_000 });
    await expect(page.locator('chat-interrupt-panel')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Timeline' }).click();
    await expect(page.getByRole('region', { name: 'Chat devtools' })).toContainText(/checkpoint/i);
    expect(hygiene.consoleErrors).toEqual([]);
  });
});
