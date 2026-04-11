import { test, expect } from '@playwright/test';

test('landing page renders hero headline', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  const headline = await page.locator('h1').textContent();
  expect(headline).toContain('Angular');
});

test('landing page renders architecture section', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Architecture').first()).toBeVisible();
});

test('landing page renders libraries section', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Three libraries. One architecture.').first()).toBeVisible();
});

test('pricing page shows 4 plan cards', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByText('Community').first()).toBeVisible();
  await expect(page.getByText('Developer Seat').first()).toBeVisible();
  await expect(page.getByText('App Deployment').first()).toBeVisible();
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
