// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { sendPromptAndWait } from './test-helpers';

// a2ui generative-UI parity over AG-UI: the wrapped a2ui content reaches the
// chat composition over ag-ui identically to langgraph; the surface mounts once
// the host binds a `views` catalog (`[views]` on <chat>). See issue #616.
test('a2ui single bubble: one assistant bubble carries the rendered surface', async ({ page }) => {
  await sendPromptAndWait(page, 'Demo: render a feedback form');

  // After the assistant turn finalizes, the surface element is in the DOM.
  const surface = page.locator('a2ui-surface');
  await expect(surface).toBeAttached();
  await expect(surface.locator('a2ui-column, [class*="column"]').first()).toBeAttached();

  // Single-bubble invariant (PR #297): exactly one <chat-message> carries the
  // assistant turn. Skeleton residue from progressive mount must not survive.
  const assistantBubbles = page.locator('chat-message').filter({
    has: page.locator('a2ui-surface, chat-streaming-md'),
  });
  await expect(assistantBubbles).toHaveCount(1);
  await expect(page.locator('chat-genui-skeleton')).toHaveCount(0);
});
