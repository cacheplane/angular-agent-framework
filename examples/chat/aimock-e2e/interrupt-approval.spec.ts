// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';

const PROMPT =
  'I want to clean up old database backups older than 90 days. Walk me through ' +
  'what you would delete, and call request_approval before doing anything ' +
  'destructive so I can review your plan.';

test('interrupt approval: pause renders the interrupt panel with the captured reason', async ({
  page,
}) => {
  await page.goto('/embed');

  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill(PROMPT);
  await page.getByRole('button', { name: /send/i }).click();

  // When the parent emits request_approval, the langgraph node calls
  // interrupt({...}) and the graph pauses. The chat composition surfaces a
  // <chat-interrupt-panel> with the captured 'reason' text. We don't wait on
  // data-streaming="false" here because the agent stays in the paused state
  // until the human responds — the interrupt panel is the durable signal.
  const panel = page.locator('chat-interrupt-panel');
  await expect(panel).toBeAttached({ timeout: 45_000 });

  // The panel title is "Agent paused" (per the smoke checklist) — verifies
  // the panel actually rendered, not just the host element being attached.
  await expect(panel).toContainText(/agent paused/i);

  // The captured reason mentions "approval" and "delete" — assert one is in
  // the panel body so the reason text is plumbing through.
  await expect.poll(
    async () => (await panel.innerText()).toLowerCase(),
    { timeout: 30_000 },
  ).toMatch(/approval|delete|backup/i);
});
