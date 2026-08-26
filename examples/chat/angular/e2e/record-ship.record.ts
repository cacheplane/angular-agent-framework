// SPDX-License-Identifier: MIT
/**
 * Records durability for the website's Ship section: send a message, reload the
 * page, and watch the conversation come back. The thread lives in a LangGraph
 * checkpoint, not in component state, so a reload restores it rather than
 * clearing it.
 *
 * NOT a test — `.record.ts`, which the e2e config's `**\/*.spec.ts` never picks
 * up. Run with `record-demo.config.ts`.
 *
 * See apps/website/scripts/upload-demo-media.md for encoding and upload.
 */
import { test, expect } from '@playwright/test';
import { openDemo } from './test-helpers';

test.describe.configure({ retries: 0 });

// Matches the markdown fixture — a response with enough structure that its
// return after reload is unmistakable on camera.
const PROMPT = 'respond with the markdown checklist kitchen sink';

test('thread survives reload', async ({ page }) => {
  await openDemo(page, '/embed');
  await page.waitForTimeout(1200);

  const input = page.getByRole('textbox', { name: /type a message|message|prompt/i });
  await input.click();
  await input.pressSequentially(PROMPT, { delay: 30 });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /send/i }).click();

  const assistant = page.locator('chat-message[data-role="assistant"]');
  await expect(assistant).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(2500);

  // The URL now carries the thread id. Reload it — this is the whole point.
  await page.reload();

  // Same content, restored from the checkpoint rather than re-sent.
  await expect(assistant).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(3500);
});
