// SPDX-License-Identifier: MIT
/**
 * Records the human-in-the-loop approval loop on the canonical demo shell —
 * the same surface as demo.threadplane.ai, so the clip matches the homepage
 * ones rather than looking like a different product.
 *
 * NOT a test — `.record.ts`, which the e2e config's `**\/*.spec.ts` never picks
 * up. Run it with `record-demo.config.ts`, which reuses the aimock-backed
 * global setup, so the take is deterministic and needs no API key.
 *
 * The scenario is deliberately the destructive-action one from
 * `interrupt-approval.spec.ts`: an agent proposing to delete old backups and
 * pausing for sign-off is the claim the compliance page actually makes.
 *
 * See apps/website/scripts/upload-demo-media.md for encoding and upload.
 */
import { test, expect } from '@playwright/test';
import { openDemo } from './test-helpers';

test.describe.configure({ retries: 0 });

// VERBATIM from interrupt-approval.spec.ts. aimock fixtures match on the exact
// user message — reword this and the agent never calls request_approval, so the
// graph never pauses and there is nothing to record.
const PROMPT =
  'I want to clean up old database backups older than 90 days. Walk me through ' +
  'what you would delete, and call request_approval before doing anything ' +
  'destructive so I can review your plan.';

test('hitl approval loop', async ({ page }) => {
  await openDemo(page, '/embed');
  await page.waitForTimeout(1500);

  const input = page.getByRole('textbox', { name: /type a message|message|prompt/i });
  await input.click();
  await input.pressSequentially(PROMPT, { delay: 28 });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /send/i }).click();

  // The graph pauses on interrupt() and the panel renders. Hold here — this is
  // the beat the clip exists to show.
  // `toBeAttached`, not visible: the e2e suite waits the same way — the panel
  // is a durable paused-state signal, not a transient popup.
  const panel = page.locator('chat-interrupt-panel');
  await expect(panel).toBeAttached({ timeout: 90_000 });
  await expect(panel).toContainText(/agent paused/i, { timeout: 30_000 });
  await panel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(3200);

  // Approve, and let the agent resume and finish.
  await panel.getByRole('button', { name: /accept/i }).click();
  await page.waitForTimeout(4000);
});
