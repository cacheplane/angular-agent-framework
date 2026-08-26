// SPDX-License-Identifier: MIT
/**
 * Records the human-in-the-loop loop as a screen capture for the website.
 *
 * NOT a test — `.record.ts`, so the normal `**\/*.spec.ts` config never picks it
 * up in CI. Run it with `record-demo.config.ts`, which boots the same aimock
 * backend the e2e suite uses, so the take is deterministic and needs no API key.
 *
 * Pacing is deliberate: the clip has to be readable at a glance on a marketing
 * page, so it types at human speed and holds on the two beats that matter —
 * the approval panel appearing, and the booking confirmed after Accept.
 *
 * See apps/website/scripts/upload-demo-media.md for encoding and upload.
 */
import { test, expect } from '@playwright/test';

// One take, no retries: a retry would leave two videos and the wrong one may win.
test.describe.configure({ retries: 0 });

test('hitl approval loop', async ({ page }) => {
  await page.goto('/');

  // Let the shell settle before the first keystroke — the opening frame becomes
  // the poster image.
  await page.waitForTimeout(1200);

  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.click();
  await input.pressSequentially('Book me on UA123.', { delay: 55 });
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: /send/i }).click();

  // The agent proposes, the graph pauses, the panel renders. This is the beat
  // the whole clip exists to show.
  const panel = page.locator('chat-interrupt-panel');
  await expect(panel).toBeVisible({ timeout: 60_000 });
  await panel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2600);

  await page.getByRole('button', { name: 'Accept' }).click();

  // Resumed: the tool actually runs and the booking is confirmed.
  await expect(page.getByText(/booked/i).last()).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(2400);
});
