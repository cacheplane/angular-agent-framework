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
 * The 2800ms wait is shared with the desktop recorder and is about the scripted
 * cursor, not the text: at 1500ms it is still parked where it pressed Accept,
 * which at phone width drops the arrowhead onto the word `retain` in step 3.
 * By 2800ms it has reached the composer, which reads as the walkthrough about
 * to type again rather than as a smudge on the prose. See that recorder for the
 * measured timeline; PHONE WIDTH IS THE BINDING CONSTRAINT on the value, because
 * the composer here starts filling at ~2970ms while the desktop capture has
 * until ~3200ms. The previous 2500ms was measured against an older
 * `public/hero-replay.json` and dropped the arrowhead onto "Nothing has been
 * deleted yet" once that recording changed, so re-measure whenever it does.
 *
 * The height budget is just as coupled, and to the FIXTURE rather than the
 * replay: `e2e/fixtures/hero-approval.json` supplies the answer text, and its
 * opening line has to fit on ONE line at 390px (about 44 characters) or the
 * whole block shifts up and the first line is sliced off the top edge. A draft
 * that opened "Approved. Here is the cleanup I would run once you confirm the
 * backup locations:" wrapped to two lines and did exactly that.
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
import { expect, test } from '@playwright/test';
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
  await page.waitForTimeout(2800);
  // Guards the beat: `.hero__take` ships in normal flow, and a composer with
  // the next prompt already typed into it means the wait has drifted late. The
  // a2ui check catches a capture that drifted PAST typing into the second run,
  // where the composer has cleared again and would satisfy the check above.
  await expect(page.locator('.hero__take')).toBeVisible();
  await expect(page.locator('[data-hero-surface] textarea')).toHaveValue('');
  await expect(page.locator('a2ui-surface')).toHaveCount(0);
  const png = await page.screenshot({ type: 'png', fullPage: false });
  await sharp(png).resize({ width: SHIP_WIDTH }).webp({ quality: 55, effort: 6 }).toFile(OUT);
  console.log(`wrote ${OUT}`);
});
