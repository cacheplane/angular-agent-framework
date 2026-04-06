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

test('landing page renders fair comparison section', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('What Angular Stream Resource adds').first()).toBeVisible();
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
  await expect(page.locator('form')).toBeVisible();
});

test('docs page renders sidebar and content', async ({ page }) => {
  await page.goto('/docs/getting-started/introduction');
  await expect(page.locator('aside').first()).toBeVisible();
  await expect(page.locator('article')).toBeVisible();
});

test('api reference renders in docs', async ({ page }) => {
  await page.goto('/docs/api/stream-resource');
  await expect(page.getByText('streamResource()').first()).toBeVisible();
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
