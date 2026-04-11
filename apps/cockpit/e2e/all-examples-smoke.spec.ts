import { expect, test } from '@playwright/test';

/**
 * Smoke test that verifies every capability example's Angular app is running
 * and can render the chat interface. Requires all 15 Angular apps to be served.
 *
 * Run with: npx playwright test apps/cockpit/e2e/all-examples-smoke.spec.ts
 *
 * Prerequisites:
 *   npx tsx apps/cockpit/scripts/serve-example.ts --all
 *   OR: nx run cockpit:serve-all
 */

const EXAMPLES = [
  { name: 'streaming', port: 4300, selector: 'app-streaming' },
  { name: 'persistence', port: 4301, selector: 'app-persistence' },
  { name: 'interrupts', port: 4302, selector: 'app-interrupts' },
  { name: 'memory', port: 4303, selector: 'app-memory' },
  { name: 'durable-execution', port: 4304, selector: 'app-durable-execution' },
  { name: 'subgraphs', port: 4305, selector: 'app-subgraphs' },
  { name: 'time-travel', port: 4306, selector: 'app-time-travel' },
  { name: 'deployment-runtime', port: 4307, selector: 'app-deployment-runtime' },
  { name: 'planning', port: 4310, selector: 'app-planning' },
  { name: 'filesystem', port: 4311, selector: 'app-filesystem' },
  { name: 'da-subagents', port: 4312, selector: 'app-subagents' },
  { name: 'da-memory', port: 4313, selector: 'app-da-memory' },
  { name: 'skills', port: 4314, selector: 'app-skills' },
  { name: 'sandboxes', port: 4315, selector: 'app-sandboxes' },
  { name: 'c-a2ui', port: 4511, selector: 'app-a2ui' },
] as const;

test.describe('All Examples Smoke Test', () => {
  for (const example of EXAMPLES) {
    test(`${example.name} (port ${example.port}) renders chat UI`, async ({ page }) => {
      await page.goto(`http://localhost:${example.port}`, { timeout: 15000 });
      await page.waitForSelector(example.selector, { state: 'attached', timeout: 10000 });

      // Verify the chat component renders
      await expect(page.locator('chat')).toBeVisible({ timeout: 5000 });

      // Verify input and send button exist
      await expect(page.locator('textarea[name="messageText"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 5000 });
    });
  }
});

test.describe('All Examples Send Message Test', () => {
  // This test requires a running LangGraph backend with OPENAI_API_KEY
  test.skip(({ }, testInfo) => !process.env['OPENAI_API_KEY'], 'Requires OPENAI_API_KEY');

  for (const example of EXAMPLES) {
    test(`${example.name} (port ${example.port}) sends and receives a message`, async ({ page }) => {
      await page.goto(`http://localhost:${example.port}`, { timeout: 15000 });
      await page.waitForSelector(example.selector, { state: 'attached', timeout: 10000 });

      // Type and send a message
      await page.fill('textarea[name="messageText"]', 'hello');
      await page.click('button[type="submit"]');

      // Wait for AI response
      await expect(page.locator('.chat-md').first()).toBeVisible({ timeout: 30000 });
      await expect(page.locator('.chat-md').first()).not.toBeEmpty({ timeout: 30000 });
    });
  }
});
