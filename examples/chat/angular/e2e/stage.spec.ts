import { test, expect, type Page } from '@playwright/test';
import { attachBrowserHygiene } from './test-helpers';
import type { StageTimeline } from '../src/app/stage/stage-timeline';

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

  test('reverse reconstruction stays behind the previous rendered frame', async ({ page }) => {
    const tl = await timeline(page);
    await page.goto(`/stage?t=${tl.totalMs}`);
    await expect(page.getByRole('textbox', { name: 'Follow-up notes' })).toBeVisible();
    await page.evaluate((target) => {
      const native = document.startViewTransition.bind(document);
      document.startViewTransition = ((update: () => Promise<void>) => {
        const transition = native(async () => {
          requestAnimationFrame(() => document.documentElement.setAttribute('data-test-frame-escaped', 'true'));
          await update();
          document.documentElement.setAttribute('data-test-rewind-staged', 'true');
          await new Promise<void>((resolve) => document.addEventListener('release-rewind', () => resolve(), { once: true }));
        });
        void transition.finished.then(() => document.documentElement.setAttribute('data-test-rewind-finished', 'true'));
        return transition;
      }) as typeof document.startViewTransition;
      const debug = window as unknown as { ng: { getComponent(el: Element): { requestSeek(t: number): void } } };
      const host = document.querySelector('stage-mode');
      if (!host) throw new Error('missing stage');
      debug.ng.getComponent(host).requestSeek(target);
    }, tl.beats[1].endMs - 100);
    await expect(page.locator('html')).toHaveAttribute('data-test-rewind-staged', 'true');
    // The browser keeps its old frame: rendering callbacks cannot run while
    // reconstruction is inside the view-transition update callback.
    await expect(page.locator('html')).not.toHaveAttribute('data-test-frame-escaped');
    await page.evaluate(() => document.dispatchEvent(new Event('release-rewind')));
    await expect(page.locator('html')).toHaveAttribute('data-test-rewind-finished', 'true');
    await expect(page.locator('a2ui-surface')).toHaveCount(0);
  });

  test('streams research inside a subagent card and rewinds cleanly', async ({ page }) => {
    const tl = await timeline(page);
    const run = tl.runs.find((r) => r.run.beat === 'subagents');
    if (!run) throw new Error('missing subagents beat');
    const child = run.run.events.filter(({ event }) =>
      event.type.startsWith('messages|tools:'));
    expect(child.length).toBeGreaterThan(1);
    const target = run.startMs + child[Math.floor(child.length * 0.75)].tMs;
    await page.goto(`/stage?t=${target}`);
    const card = page.locator('chat-subagent-card').last();
    await expect(card).toBeInViewport({ timeout: 60_000 });
    await expect(card).toContainText(/90|120/);
    await page.goto(`/stage?t=${tl.totalMs}`);
    await expect(page.locator('a2ui-surface').first()).toBeAttached({ timeout: 60_000 });
    await page.goto('/stage?t=0');
    await expect(page.locator('chat-subagent-card')).toHaveCount(0);
  });

  test('renders the chat beside the devtools and seeks to the approve hold', async ({ page }) => {
    const hygiene = attachBrowserHygiene(page);
    const tl = await timeline(page);
    await expect(page.getByRole('region', { name: 'Chat devtools' })).toBeVisible();
    // +1: strictly inside the hold. The boundary instant still belongs to the
    // outgoing run (phaseReachedAt in stage-timeline.ts renders t minus an epsilon).
    await page.goto(`/stage?t=${tl.hold.startMs + 1}`);
    await expect(page.locator('chat-interrupt-panel')).toBeAttached({ timeout: 60_000 });
    // Guards the transcript pin: the panel and the newest content sit in view.
    await expect(page.locator('chat-interrupt-panel')).toBeInViewport({ timeout: 60_000 });
    // The pause comes from delete_backups, after list_backups has rendered its
    // registered tool view — the inventory the visitor is being asked about.
    await expect(page.locator('app-backup-table [data-state="rows"]')).toBeAttached();
    // Replay is a recording, not a control surface: the panel shows but cannot
    // be clicked, so a visitor cannot desync the transcript from t.
    expect(
      await page
        .locator('[data-stage-interrupt]')
        .evaluate((el) => getComputedStyle(el).pointerEvents),
    ).toBe('auto');
    expect(hygiene.consoleErrors).toEqual([]);
    await page.route('**/embed', route => route.fulfill({ contentType: 'text/html', body: '<h1>Live demo</h1>' }));
    await page.locator('[data-stage-interrupt]').getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(page).toHaveURL(/\/embed$/);
  });

  test('the end of the recording mounts the generated form and the devtools shows the thread', async ({
    page,
  }) => {
    const hygiene = attachBrowserHygiene(page);
    const tl = await timeline(page);
    await page.goto(`/stage?t=${tl.totalMs}`);
    await expect(page.locator('a2ui-surface').first()).toBeAttached({ timeout: 90_000 });
    // Guards the transcript pin: the generated form is the newest content.
    await expect(page.locator('a2ui-surface').first()).toBeInViewport({ timeout: 90_000 });
    await expect(page.getByRole('textbox', { name: 'Follow-up notes' })).toBeVisible();
    await expect(page.locator('a2ui-surface').first()).not.toContainText('Building UI');
    await expect(page.locator('chat-interrupt-panel')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Timeline' }).click();
    await expect(page.getByRole('region', { name: 'Chat devtools' })).toContainText(/checkpoint/i);
    expect(hygiene.consoleErrors).toEqual([]);
  });
});
