/**
 * Records generative UI for the website's Render section: the agent emits a
 * json-render spec and the demo mounts it as real Angular components.
 *
 * NOT a test — `.record.ts`, which the e2e config's `**\/*.spec.ts` never picks
 * up. Run with `record-demo.config.ts`, which boots the same aimock backend the
 * e2e suite uses, so the take is deterministic and needs no API key.
 *
 * See apps/website/scripts/upload-demo-media.md for encoding and upload.
 */
import { test, expect } from '@playwright/test';
import { openDemo } from './test-helpers';

test.describe.configure({ retries: 0 });

// VERBATIM from FEATURED_SUGGESTIONS[0] in modes/welcome-suggestions.ts, which
// is also what the contact-form fixture matches. Reword it and the agent never
// emits a spec, so there is nothing to record.
const PROMPT =
  'Show me a contact form with fields for name, email address, subject, and a ' +
  'multi-line message, plus a Send button.';

test('generative ui render', async ({ page }) => {
  await openDemo(page, '/embed');
  await page.waitForTimeout(1500);

  const input = page.getByRole('textbox', { name: /type a message|message|prompt/i });
  await input.click();
  await input.pressSequentially(PROMPT, { delay: 26 });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /send/i }).click();

  // The spec streams in and mounts as components — the beat worth showing.
  await expect(page.locator('chat-message[data-role="assistant"]')).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(6000);
});
