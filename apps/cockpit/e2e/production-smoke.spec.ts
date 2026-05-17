import { expect, test } from '@playwright/test';

/**
 * Production smoke test: verifies the deployed cockpit shell and deployed
 * example apps are reachable after production deploy.
 *
 * Requires:
 *   BASE_URL - e.g. https://cockpit.cacheplane.ai
 *   EXAMPLES_URL - e.g. https://examples.cacheplane.ai
 *   OPENAI_API_KEY - optional; enables send/receive checks
 *
 * Run:
 *   BASE_URL=https://cockpit.cacheplane.ai \
 *   EXAMPLES_URL=https://examples.cacheplane.ai \
 *   npx playwright test apps/cockpit/e2e/production-smoke.spec.ts
 */

const COCKPIT_URL = process.env['BASE_URL'] ?? 'https://cockpit.cacheplane.ai';
const EXAMPLES_URL = process.env['EXAMPLES_URL'] ?? 'https://examples.cacheplane.ai';

const CHAT_CAPABILITIES = [
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
  'chat/tool-calls',
  'chat/subagents',
  'chat/threads',
  'chat/timeline',
  'chat/generative-ui',
  'chat/theming',
  'chat/a2ui',
] as const;

const CHAT_PRIMITIVE_CAPABILITIES = [
  'chat/messages',
  'chat/input',
  'chat/interrupts',
  'chat/debug',
] as const;

const RENDER_CAPABILITIES = [
  'render/spec-rendering',
  'render/element-rendering',
  'render/state-management',
  'render/registry',
  'render/repeat-loops',
  'render/computed-functions',
] as const;

test.describe('Production: Angular chat example apps load', () => {
  for (const cap of CHAT_CAPABILITIES) {
    test(`${cap} loads at examples URL`, async ({ page }) => {
      const response = await page.goto(`${EXAMPLES_URL}/${cap}/`, { timeout: 15_000 });
      expect(response?.status()).toBe(200);
      await expect(page.locator('chat')).toBeVisible({ timeout: 10_000 });
    });
  }
});

test.describe('Production: Angular chat primitive apps load', () => {
  for (const cap of CHAT_PRIMITIVE_CAPABILITIES) {
    test(`${cap} loads at examples URL`, async ({ page }) => {
      const response = await page.goto(`${EXAMPLES_URL}/${cap}/`, { timeout: 15_000 });
      expect(response?.status()).toBe(200);
      await expect(page.locator('body')).not.toBeEmpty({ timeout: 10_000 });
    });
  }
});

test.describe('Production: render example apps load', () => {
  for (const cap of RENDER_CAPABILITIES) {
    test(`${cap} loads at examples URL`, async ({ page }) => {
      const response = await page.goto(`${EXAMPLES_URL}/${cap}/`, { timeout: 15_000 });
      expect(response?.status()).toBe(200);
      await expect(page.locator('body')).not.toBeEmpty({ timeout: 10_000 });
    });
  }
});

test.describe('Production: cockpit shell loads', () => {
  test('cockpit loads with sidebar navigation', async ({ page }) => {
    await page.goto(COCKPIT_URL, { timeout: 15_000 });
    await expect(page.getByRole('navigation', { name: 'Cockpit navigation' })).toBeVisible();

    const links = await page.locator('nav a').allTextContents();
    const overviewLinks = links.filter((text) => text.toLowerCase().includes('overview'));
    expect(overviewLinks).toHaveLength(0);
  });
});

test.describe('Production: send/receive smoke', () => {
  test.skip(() => !process.env['OPENAI_API_KEY'], 'Requires OPENAI_API_KEY');

  for (const cap of ['langgraph/streaming', 'deep-agents/planning', 'chat/a2ui'] as const) {
    test(`${cap} sends and receives a message`, async ({ page }) => {
      await page.goto(`${EXAMPLES_URL}/${cap}/`, { timeout: 15_000 });
      await expect(page.locator('chat')).toBeVisible({ timeout: 10_000 });

      await page.locator('textarea[name="messageText"]').fill('hello');
      await page.getByRole('button', { name: /send message/i }).click();

      if (cap === 'chat/a2ui') {
        await expect(page.locator('a2ui-surface')).toBeAttached({ timeout: 30_000 });
        return;
      }

      await expect(page.locator('chat-message[data-role="assistant"]').last()).toBeVisible({
        timeout: 30_000,
      });
    });
  }
});
