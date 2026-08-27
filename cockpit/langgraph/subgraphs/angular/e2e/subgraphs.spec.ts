// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';

// Distinctive line from the research subgraph's brief. It exists only in the
// child graph's `research_brief` output, never in the parent's answer — which
// is what makes it usable as a probe for the state boundary.
const BRIEF_MARKER = 'one state snapshot per super-step';

test.describe('cockpit subgraphs: conditional nesting', () => {
  test('a research question routes into the child graph and shows its brief', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Ask something that needs research').click();

    const finalAssistant = page
      .locator('chat-message[data-role="assistant"][data-streaming="false"]')
      .last();
    await expect(finalAssistant).toBeAttached({ timeout: 30_000 });

    const panel = page.getByTestId('subgraph-panel');
    await expect(panel.getByTestId('route')).toContainText('Nested');
    await expect(panel.getByTestId('research-topic')).toContainText('checkpointer persists');
    await expect(panel.getByTestId('research-brief')).toContainText(BRIEF_MARKER);
    await expect(finalAssistant).toContainText('Checkpointing saves');
  });

  test("the child's brief never reaches the transcript", async ({ page }) => {
    await page.goto('/');
    await page.getByText('Ask something that needs research').click();

    // Sidebar has it (proves the assertion below is not vacuous — the brief
    // was produced and delivered, it just went somewhere the transcript isn't).
    await expect(page.getByTestId('research-brief')).toContainText(BRIEF_MARKER, {
      timeout: 30_000,
    });
    await expect(
      page.locator('chat-message[data-role="assistant"][data-streaming="false"]').last(),
    ).toBeAttached({ timeout: 30_000 });

    // Scan every rendered message, not just the last one.
    await expect(page.locator('chat-message').filter({ hasText: BRIEF_MARKER })).toHaveCount(0);
    await expect(page.locator('chat-message')).toHaveCount(2); // the ask + the parent's answer
  });

  test('a greeting skips the child graph and still answers', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Ask something that does not').click();

    const finalAssistant = page
      .locator('chat-message[data-role="assistant"][data-streaming="false"]')
      .last();
    await expect(finalAssistant).toBeAttached({ timeout: 30_000 });
    await expect(finalAssistant).toContainText('I answer questions');

    const panel = page.getByTestId('subgraph-panel');
    await expect(panel.getByTestId('route')).toContainText('Direct');
    await expect(panel.getByTestId('research-brief')).toHaveCount(0);
  });
});
