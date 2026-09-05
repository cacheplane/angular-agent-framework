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
 * The wait is 2500ms rather than the 1500ms this script used to hold, because
 * the two land the scripted cursor in different places. At 1500ms it is still
 * parked where it pressed Accept, which on the phone capture put the arrowhead
 * on top of the word `retain` in step 3 — an artifact, not a hint that the demo
 * is live. HOLD_AFTER_ANSWER_MS (2000) plus CURSOR_MOVE_MS (650) puts it at the
 * composer at ~2650ms and typing starts immediately after, so 2500ms catches it
 * arriving with the composer still empty. The empty-composer assertion below is
 * what keeps a mistimed capture from shipping silently: the poster this
 * replaced had the second prompt already typed into it.
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
  await page.waitForTimeout(2500);
  // The frame has to show what ships today, not a layout we have replaced.
  // `.hero__take` was moved out of absolute positioning and into normal flow;
  // the poster this replaced still had it floating over the composer.
  await expect(page.locator('.hero__take')).toBeVisible();
  await expect(page.locator('[data-hero-surface] textarea')).toHaveValue('');
  const png = await page.screenshot({ type: 'png', fullPage: false });
  await sharp(png).webp({ quality: 82 }).toFile(OUT);
  console.log(`wrote ${OUT}`);
});
