/**
 * NOT a test. Captures the phone-width companion to
 * `record-hero-poster.record.ts`: the same walkthrough beat rendered at phone
 * dimensions, rather than cropped out of the 1200x720 desktop capture.
 *
 * Beat: the FIRST STREAMED REPLY, the same beat as the desktop poster, so
 * crossing the 768px breakpoint swaps the source without changing the story.
 * 650 CSS px is the shortest height at which the whole answer fits from its
 * first line — "Approved. Here is the cleanup I would run:" through the
 * three-step plan, the message actions and the composer — with nothing sliced
 * at the top edge. The approval-interrupt beat was the other candidate and was
 * rejected twice over: at phone height the panel slices the user's prompt
 * bubble behind it, and a still of a live Accept / Edit / Respond dialog
 * invites taps that do nothing.
 *
 * Geometry: 390x650 is the phone design width the reviews already use, and it
 * is exactly 3:5 — the ratio `.hero-demo-stage` holds below 768px — so
 * `object-fit: cover` crops nothing. The frame is captured at
 * deviceScaleFactor 2 for crisp glyph rasterisation and shipped resized to
 * 585x975 (1.5x): the poster is displayed ~348 CSS px wide on a phone, and 2x
 * would cost ~51KB against the desktop poster's 37KB.
 *
 *   npx playwright test --config examples/chat/angular/e2e/record-hero.config.ts record-hero-poster-mobile
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import sharp from 'sharp';

const OUT = resolve(
  __dirname,
  '../../../../apps/website/public/screenshots/hero-walkthrough-poster-mobile.webp',
);
const SHIP_WIDTH = 585;

test.use({ viewport: { width: 390, height: 650 }, deviceScaleFactor: 2 });

test('capture mobile hero poster', async ({ page }) => {
  await page.goto('/hero');
  // The scripted cursor types prompt 1, sends, and the replay pauses on the
  // approval interrupt; the script then presses Accept.
  const interruptPanel = page.locator('chat-interrupt-panel');
  await interruptPanel.waitFor({ timeout: 60_000 });
  await interruptPanel.waitFor({ state: 'detached', timeout: 60_000 });
  await page.waitForTimeout(1500);
  const png = await page.screenshot({ type: 'png', fullPage: false });
  await sharp(png).resize({ width: SHIP_WIDTH }).webp({ quality: 55, effort: 6 }).toFile(OUT);
  console.log(`wrote ${OUT}`);
});
