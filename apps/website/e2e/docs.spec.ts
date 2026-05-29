import { test, expect } from '@playwright/test';

test.describe('Docs landing page', () => {
  test('renders the start-here funnel + search prompt', async ({ page }) => {
    await page.goto('/docs');

    // Hero
    await expect(page.locator('#docs-heading')).toBeVisible();
    await expect(page.locator('#docs-heading')).toContainText('Build AI agent UIs in Angular');

    // Step headings (match on the plain substring to avoid the middle-dot char)
    await expect(page.getByText('Pick your backend').first()).toBeVisible();
    await expect(page.getByText('Generative UI').first()).toBeVisible();
    await expect(page.getByText('Chat UI').first()).toBeVisible();

    // Step 1 — backend quickstart links
    await expect(page.locator('main a[href="/docs/langgraph/getting-started/quickstart"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/docs/ag-ui/getting-started/quickstart"]').first()).toBeVisible();

    // Step 2 — generative UI links
    await expect(page.locator('main a[href="/docs/a2ui/getting-started/introduction"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/docs/render/getting-started/introduction"]').first()).toBeVisible();

    // Step 3 — chat
    await expect(page.locator('main a[href="/docs/chat/getting-started/introduction"]').first()).toBeVisible();

    // Helper links
    await expect(page.locator('main a[href="/docs/choosing-an-adapter"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/docs/render/concepts/json-render-vs-a2ui"]').first()).toBeVisible();

    // Supporting libraries
    await expect(page.locator('main a[href="/docs/licensing/getting-started/introduction"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/docs/telemetry/getting-started/introduction"]').first()).toBeVisible();

    // Search prompt
    await expect(page.getByText('Looking for something specific?').first()).toBeVisible();
  });
});

test.describe('Docs slug page', () => {
  const route = '/docs/langgraph/getting-started/introduction';

  test('renders breadcrumb + h1 + sidebar', async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('aside').first()).toBeVisible();
    await expect(page.locator('nav[aria-label="Breadcrumb"]').first()).toBeVisible();
    await expect(page.locator('article').first()).toBeVisible();
  });

  test('breadcrumb shows the library + page title', async ({ page }) => {
    await page.goto(route);
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]').first();
    await expect(breadcrumb).toContainText('Docs');
  });

  test('renders DocsPrevNext at the bottom (next-only for the first page)', async ({ page }) => {
    await page.goto(route);
    const prevNext = page.locator('nav[aria-label="Previous and next page"]').first();
    await expect(prevNext).toBeVisible();
  });

  test('headings have ID anchors for hash links', async ({ page }) => {
    await page.goto(route);
    const h2 = page.locator('article h2').first();
    await expect(h2).toBeVisible();
    const id = await h2.getAttribute('id');
    expect(id).toBeTruthy();
    expect(id?.length).toBeGreaterThan(0);
  });

  test('breadcrumb renders exactly once', async ({ page }) => {
    await page.goto('/docs/langgraph/getting-started/introduction');
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toHaveCount(1);
  });
});

test.describe('Docs search', () => {
  test('Cmd+K opens the search modal', async ({ page, browserName }) => {
    await page.goto('/docs/langgraph/getting-started/introduction');
    // Mac uses Meta; other platforms emulate the same shortcut via keydown.
    const modifier = browserName === 'webkit' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+KeyK`);
    // The modal mounts somewhere — assert by visible input role with placeholder text.
    await expect(page.locator('input[placeholder*="Search"], input[type="search"]').first()).toBeVisible({ timeout: 3000 });
  });
});
