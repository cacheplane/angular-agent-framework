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
 */
import { test } from '@playwright/test';
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
  await page.waitForTimeout(1500);
  const png = await page.screenshot({ type: 'png', fullPage: false });
  await sharp(png).webp({ quality: 82 }).toFile(OUT);
  console.log(`wrote ${OUT}`);
});
