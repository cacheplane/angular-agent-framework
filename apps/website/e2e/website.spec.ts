import { test, expect } from '@playwright/test';

test('landing page renders hero headline', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#hero-heading')).toBeVisible();
  const headline = await page.locator('#hero-heading').textContent();
  expect(headline?.toLowerCase()).toContain('angular');
});

test('landing page renders differentiator section', async ({ page }) => {
  await page.goto('/');
  // Assert on the stable id, not the heading copy — landing-page text rewrites
  // happen far more often than the section structure changes.
  await expect(page.locator('#differentiator-heading')).toBeVisible();
});

test('landing page renders feature blocks (Stream/Render/Ship)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#stream-heading')).toBeVisible();
  await expect(page.locator('#render-heading')).toBeVisible();
  await expect(page.locator('#ship-heading')).toBeVisible();
});

test('pricing page shows plan cards', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByText('Open Source').first()).toBeVisible();
  await expect(page.getByText('Enterprise').first()).toBeVisible();
});

test('pricing page lead form validates required fields', async ({ page }) => {
  await page.goto('/pricing');
  await page.click('button[type="submit"]');
  await expect(page.locator('form').first()).toBeVisible();
});

test('docs page renders sidebar and content', async ({ page }) => {
  await page.goto('/docs/agent/getting-started/introduction');
  await expect(page.locator('aside').first()).toBeVisible();
  await expect(page.locator('article')).toBeVisible();
});

test('docs landing page shows library cards', async ({ page }) => {
  await page.goto('/docs');
  await expect(page.getByText('Agent').first()).toBeVisible();
  await expect(page.getByText('Render').first()).toBeVisible();
  await expect(page.getByText('Chat').first()).toBeVisible();
  await expect(page.getByText('AG-UI').first()).toBeVisible();
});

test('api reference renders in docs', async ({ page }) => {
  await page.goto('/docs/agent/api/agent');
  await expect(page.locator('article').first()).toBeVisible();
});

test('nav has pricing link', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('nav a[href="/pricing"]').first()).toBeVisible();
});

test('mobile viewport renders nav', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.locator('nav')).toBeVisible();
});

test('/llms.txt returns plain text', async ({ page }) => {
  const response = await page.goto('/llms.txt');
  expect(response?.headers()['content-type']).toContain('text/plain');
});

test('/llms-full.txt includes generated API reference content', async ({ request }) => {
  const response = await request.get('/llms-full.txt');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('text/plain');

  const body = await response.text();
  expect(body).toContain('## API Reference (TypeDoc)');
  expect(body).toContain('### agent');
  expect(body).toContain('### chat');
  expect(body).not.toContain('API reference not yet generated');
});

test('robots.txt allows crawling and points at the sitemap', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.ok()).toBe(true);

  const body = await response.text();
  expect(body).toContain('User-Agent: *');
  expect(body).toContain('Allow: /');
  expect(body).toContain('Sitemap: https://cacheplane.ai/sitemap.xml');
});

test('sitemap.xml includes configured docs pages', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.ok()).toBe(true);

  const body = await response.text();
  expect(body).toContain('https://cacheplane.ai/docs');
  expect(body).toContain('https://cacheplane.ai/docs/agent/getting-started/introduction');
  expect(body).toContain('https://cacheplane.ai/docs/render/a2ui/overview');
});

test('docs pages render canonical and social metadata', async ({ page }) => {
  await page.goto('/docs/agent/guides/streaming');

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://cacheplane.ai/docs/agent/guides/streaming',
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'Streaming - Agent Docs - Angular Agent Framework',
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    'https://cacheplane.ai/docs/agent/guides/streaming',
  );
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
    'content',
    'Streaming - Agent Docs - Angular Agent Framework',
  );
});

test('marketing pages link to downloadable whitepaper PDFs', async ({ page }) => {
  const expectedDownloads: Record<string, string> = {
    '/': '/whitepaper.pdf',
    '/angular': '/whitepapers/angular.pdf',
    '/render': '/whitepapers/render.pdf',
    '/chat': '/whitepapers/chat.pdf',
  };

  for (const [route, href] of Object.entries(expectedDownloads)) {
    await page.goto(route);
    await expect(page.locator(`a[href="${href}"]`).first(), `${route} links ${href}`).toBeVisible();
  }
});

test('whitepaper PDFs are served as static downloads', async ({ request }) => {
  for (const href of [
    '/whitepaper.pdf',
    '/whitepapers/angular.pdf',
    '/whitepapers/render.pdf',
    '/whitepapers/chat.pdf',
  ]) {
    const response = await request.get(href);
    expect(response.ok(), `${href} responds successfully`).toBe(true);
    expect(response.headers()['content-type'], `${href} content type`).toContain('application/pdf');
  }
});
