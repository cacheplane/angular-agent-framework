// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';

test('a2ui single bubble: one assistant bubble carries the rendered surface', async ({ page }) => {
  await page.goto('/embed');

  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill('Demo: render a feedback form');
  await page.getByRole('button', { name: /send/i }).click();

  // Surface element materializes in the DOM. Use toBeAttached rather than
  // toBeVisible — the bubble container can have zero computed size during
  // progressive mount and Playwright's strict visibility heuristic flags
  // that even when the surface is rendering correctly.
  const surface = page.locator('a2ui-surface');
  await expect(surface).toBeAttached({ timeout: 45_000 });

  // Surface has the rendered Column structure (from the captured fixture).
  await expect.poll(async () => surface.locator('a2ui-column, [class*="column"]').count(), {
    timeout: 30_000,
  }).toBeGreaterThan(0);

  // Single-bubble invariant (PR #297): exactly one <chat-message> carries the
  // assistant turn. Skeleton residue from progressive mount must not survive.
  const assistantBubbles = page.locator('chat-message').filter({
    has: page.locator('a2ui-surface, chat-streaming-md'),
  });
  await expect(assistantBubbles).toHaveCount(1);
  await expect(page.locator('chat-genui-skeleton')).toHaveCount(0);
});
