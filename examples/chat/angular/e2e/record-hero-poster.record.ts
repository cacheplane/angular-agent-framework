/**
 * NOT a test. Captures a frame of the hero walkthrough as the website's
 * server-rendered poster (1200x720, webp). Run through record-hero.config.ts:
 *   npx playwright test --config examples/chat/angular/e2e/record-hero.config.ts record-hero-poster
 *
 * The beat is the FIRST STREAMED REPLY: the approval interrupt has just been
 * accepted by the scripted cursor and the answer is on screen. The earlier
 * "typing the first prompt" frame is mostly empty canvas; this one shows the
 * user turn, the tool call, the rendered answer and the cursor heading back to
 * the composer — it reads as a product, not as a blank chat box.
 *
 * The wait exists to land the scripted cursor somewhere that is not on top of
 * the prose. It used to be 1500ms, which left the arrowhead parked where it
 * pressed Accept — on the phone capture, on top of the word `retain` in step 3,
 * an artifact rather than a hint that the demo is live.
 *
 * 2800ms is MEASURED, not derived. Instrumenting the walkthrough (sampling the
 * cursor's bounding box every 100ms from the moment the interrupt panel
 * detaches) gives this timeline, and it is close to but not the same as the
 * arithmetic HOLD_AFTER_ANSWER_MS + CURSOR_MOVE_MS would predict, because the
 * panel detaches partway through the resume run rather than at the click:
 *
 *   ~0–2400ms   parked at Accept
 *   ~2400ms     glide starts (600ms CSS transition on transform)
 *   ~2650ms     arrowhead clears the last line of the answer
 *   ~3000ms     glide ends at the composer
 *   ~3200ms     the second prompt starts typing
 *
 * So the frame is clean anywhere in ~2700–3150ms, and 2800ms sits in the middle
 * of that with the cursor low on its glide, reading as the walkthrough about to
 * type again. Both this and the phone recorder use the same number; the phone
 * window is the tighter of the two (its composer starts filling at ~2970ms),
 * which is what pins the value down. RE-MEASURE AFTER RE-RECORDING
 * `public/hero-replay.json`: the whole timeline hangs off that recording's event
 * timings, and the previous 2500ms stopped working when the replay was
 * re-recorded for a new first prompt.
 *
 * The assertions below are what keep a mistimed capture from shipping silently.
 * The empty composer catches a capture that drifted late into typing — the
 * poster this replaced had the second prompt already typed into it — and the
 * absent a2ui surface catches one that drifted so far that the second prompt
 * has been SENT, which would otherwise satisfy the empty-composer check on its
 * own once the composer cleared.
 */
import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import sharp from 'sharp';

const OUT = resolve(__dirname, '../../../../apps/website/public/screenshots/hero-walkthrough-poster.webp');

test('capture hero poster', async ({ page }) => {
  await page.goto('/hero');
  // The scripted cursor types prompt 1, sends, and the replay pauses on the
  // approval interrupt; the script then presses Accept.
  const interruptPanel = page.locator('chat-interrupt-panel');
  await interruptPanel.waitFor({ timeout: 60_000 });
  await interruptPanel.waitFor({ state: 'detached', timeout: 60_000 });
  await page.waitForTimeout(2800);
  // The frame has to show what ships today, not a layout we have replaced.
  // `.hero__take` was moved out of absolute positioning and into normal flow;
  // the poster this replaced still had it floating over the composer.
  await expect(page.locator('.hero__take')).toBeVisible();
  await expect(page.locator('[data-hero-surface] textarea')).toHaveValue('');
  await expect(page.locator('a2ui-surface')).toHaveCount(0);
  const png = await page.screenshot({ type: 'png', fullPage: false });
  await sharp(png).webp({ quality: 82 }).toFile(OUT);
  console.log(`wrote ${OUT}`);
});
