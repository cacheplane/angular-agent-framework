// SPDX-License-Identifier: MIT
//
// Manual (live-LLM) counterpart to subgraphs.spec.ts. Run against a real
// OpenAI key with the example served on its cockpit port — the routing
// decision is a genuine model call here, so assertions check the branch that
// actually ran rather than baking in a fixture's answer.
import { expect, test } from '@playwright/test';

test.describe('LangGraph Subgraphs Example (live)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4305');
    await page.waitForSelector('app-subgraphs', { state: 'attached' });
  });

  test('a research question routes into the child graph', async ({ page }) => {
    await page.fill('textarea[name="messageText"]', 'How does LangGraph checkpointing work?');
    await page.click('button[type="submit"]');

    const panel = page.getByTestId('subgraph-panel');
    await expect(panel.getByTestId('route')).toContainText('Nested', { timeout: 60_000 });
    await expect(panel.getByTestId('research-topic')).not.toBeEmpty({ timeout: 60_000 });
    await expect(panel.getByTestId('research-brief')).not.toBeEmpty({ timeout: 60_000 });

    const assistant = page
      .locator('chat-message[data-role="assistant"][data-streaming="false"]')
      .last();
    await expect(assistant).toBeAttached({ timeout: 60_000 });
    await expect(assistant.locator('.chat-md')).not.toBeEmpty();
  });

  test('a greeting skips the child graph', async ({ page }) => {
    await page.fill('textarea[name="messageText"]', 'hi there');
    await page.click('button[type="submit"]');

    const assistant = page
      .locator('chat-message[data-role="assistant"][data-streaming="false"]')
      .last();
    await expect(assistant).toBeAttached({ timeout: 60_000 });
    await expect(assistant.locator('.chat-md')).not.toBeEmpty();

    const panel = page.getByTestId('subgraph-panel');
    await expect(panel.getByTestId('route')).toContainText('Direct');
    await expect(panel.getByTestId('research-brief')).toHaveCount(0);
  });
});
