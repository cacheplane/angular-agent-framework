import { expect, test } from '@playwright/test';

test('renders navigation and shell on the home page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main', { name: 'Cockpit shell' })).toHaveAttribute(
    'data-hydrated',
    'true'
  );

  await expect(page.getByRole('navigation', { name: 'Cockpit navigation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Code', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Docs', exact: true })).toBeVisible();
});

test('navigates from the sidebar to a capability route', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main', { name: 'Cockpit shell' })).toHaveAttribute(
    'data-hydrated',
    'true'
  );

  // Sidebar strips "LangGraph " prefix, so the link text is just "Persistence"
  await page.getByRole('link', { name: 'Persistence', exact: true }).click();

  await expect(page).toHaveURL(/\/langgraph\/core-capabilities\/persistence\/overview\/python$/);
  await expect(page.getByRole('main', { name: 'Cockpit shell' })).toHaveAttribute(
    'data-hydrated',
    'true'
  );

  // Mode switcher should still be present
  await expect(page.getByRole('button', { name: 'Code', exact: true })).toBeVisible();
});

test('falls back to the product overview when a missing typescript route is requested', async ({ page }) => {
  await page.goto('/langgraph/core-capabilities/streaming/overview/typescript');

  await expect(page).toHaveURL(/\/langgraph\/getting-started\/overview\/overview\/python$/);
  await expect(page.getByRole('main', { name: 'Cockpit shell' })).toHaveAttribute(
    'data-hydrated',
    'true'
  );
});
