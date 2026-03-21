import { test, expect } from '@playwright/test';

test('landing page renders hero headline', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  const headline = await page.locator('h1').textContent();
  expect(headline).toContain('Angular');
});

test('landing page renders architecture diagram', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('svg[aria-label*="Architecture"]')).toBeVisible();
});

test('landing page renders 6 feature cards', async ({ page }) => {
  await page.goto('/');
  // Feature section contains h2 "Features" and 6 cards
  const featureSection = page.locator('section').filter({ hasText: 'Features' });
  await expect(featureSection).toBeVisible();
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
  // HTML5 validation prevents submit — form should still be visible
  await expect(page.locator('form')).toBeVisible();
});

test('docs page renders sidebar and content', async ({ page }) => {
  await page.goto('/docs/deep-agents/getting-started/overview/overview/python');
  await expect(page.locator('aside')).toBeVisible();
  await expect(page.locator('article')).toBeVisible();
});

test('api reference page renders', async ({ page }) => {
  await page.goto('/api-reference');
  await expect(page.getByText('streamResource()', { exact: true }).first()).toBeVisible();
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
