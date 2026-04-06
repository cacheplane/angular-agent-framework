import { expect, test } from '@playwright/test';

/**
 * Production smoke test — verifies the deployed stack works end-to-end.
 *
 * Requires:
 *   EXAMPLES_URL - e.g., https://examples.stream-resource.dev
 *   OPENAI_API_KEY - for send/receive tests (optional)
 *
 * Run:
 *   BASE_URL=https://cockpit.stream-resource.dev \
 *   EXAMPLES_URL=https://examples.stream-resource.dev \
 *   npx playwright test apps/cockpit/e2e/production-smoke.spec.ts
 */

const EXAMPLES_URL = process.env['EXAMPLES_URL'] ?? 'https://examples.stream-resource.dev';

const CAPABILITIES = [
  'langgraph/streaming',
  'langgraph/persistence',
  'langgraph/interrupts',
  'langgraph/memory',
  'langgraph/durable-execution',
  'langgraph/subgraphs',
  'langgraph/time-travel',
  'langgraph/deployment-runtime',
  'deep-agents/planning',
  'deep-agents/filesystem',
  'deep-agents/subagents',
  'deep-agents/memory',
  'deep-agents/skills',
  'deep-agents/sandboxes',
] as const;

test.describe('Production: Angular example apps load', () => {
  for (const cap of CAPABILITIES) {
    test(`${cap} loads at examples URL`, async ({ page }) => {
      const url = `${EXAMPLES_URL}/${cap}/`;
      const res = await page.goto(url, { timeout: 15000 });
      expect(res?.status()).toBe(200);
      await expect(page.locator('cp-chat')).toBeVisible({ timeout: 10000 });
    });
  }
});

test.describe('Production: cockpit loads correctly', () => {
  test('cockpit loads with sidebar navigation', async ({ page }) => {
    await page.goto('/', { timeout: 15000 });
    await expect(page.getByRole('navigation', { name: 'Cockpit navigation' })).toBeVisible();
    const links = await page.locator('nav a').allTextContents();
    const overviewLinks = links.filter((t) => t.toLowerCase().includes('overview'));
    expect(overviewLinks).toHaveLength(0);
  });
});

test.describe('Production: send/receive smoke', () => {
  test.skip(() => !process.env['OPENAI_API_KEY'], 'Requires OPENAI_API_KEY');

  for (const cap of ['langgraph/streaming', 'deep-agents/planning'] as const) {
    test(`${cap} sends and receives a message`, async ({ page }) => {
      await page.goto(`${EXAMPLES_URL}/${cap}/`, { timeout: 15000 });
      await expect(page.locator('cp-chat')).toBeVisible({ timeout: 10000 });
      await page.fill('input[name="prompt"]', 'hello');
      await page.click('button[type="submit"]');
      await expect(page.locator('.cp-message--ai')).toBeVisible({ timeout: 30000 });
    });
  }
});
