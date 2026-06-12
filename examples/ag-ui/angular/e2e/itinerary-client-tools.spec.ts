// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { attachBrowserHygiene, messageInput, openDemo, sendButton } from './test-helpers';

// Exercises the frontend-declared / frontend-executed client tools over the
// AG-UI transport against THIS app. The catalog ships to the backend, the model
// emits a tool call, the browser executes it against the shared ItineraryStore,
// the ToolMessage re-runs the graph, and the continuation streams back. Each
// test starts from the store seed (Day 1: Louvre + Eiffel Tower, Day 2: Musée
// d'Orsay) by clearing the persisted key before the page hydrates.
const STORAGE_KEY = 'ag-ui-demo:itinerary';

test.beforeEach(async ({ page }) => {
  // Runs on every navigation, before app bootstrap — so ItineraryStore
  // hydrates from SEED rather than a stale localStorage payload. openDemo's
  // own localStorage.clear() runs after the first paint; this guarantees the
  // key is already absent the moment the store reads it.
  await page.addInitScript((key) => localStorage.removeItem(key), STORAGE_KEY);
});

test('panel renders the seeded itinerary', async ({ page }) => {
  await openDemo(page);

  const panel = page.getByRole('region', { name: 'Trip itinerary' });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Louvre');
  await expect(panel).toContainText('Eiffel Tower');
  await expect(panel).toContainText("Musée d'Orsay");
});

test('read round-trip: get_itinerary executes in the browser and the run continues', async ({
  page,
}) => {
  await openDemo(page);
  const hygiene = attachBrowserHygiene(page);

  await messageInput(page).fill("What's on my itinerary?");
  await sendButton(page).click();

  // The first run returns only a tool call; the browser executes get_itinerary
  // against the store, the ToolMessage re-runs the graph, and the continuation
  // streams the recap. Wait on that final content rather than the first settle.
  await expect(page.getByText('You have 3 stops planned')).toBeVisible({ timeout: 30_000 });

  expect(hygiene.consoleErrors).toEqual([]);
});

test('ask chain: clear_day confirm mutates the panel and resumes the run', async ({ page }) => {
  await openDemo(page);

  await messageInput(page).fill('Clear my day 2 plans');
  await sendButton(page).click();

  // The clear_day ask renders its confirm component; the run is paused on the
  // emitted tool result until the user decides.
  const confirm = page.locator('app-clear-day-confirm');
  await expect(confirm).toBeVisible({ timeout: 30_000 });
  await expect(confirm).toContainText('day 2');

  // Nothing has mutated yet — the panel still shows day 2's stop.
  const panel = page.getByRole('region', { name: 'Trip itinerary' });
  await expect(panel).toContainText("Musée d'Orsay");

  // Confirming writes the store (panel updates live) and emits the tool result
  // that resumes the run, whose continuation streams the closing line.
  await confirm.getByRole('button', { name: 'Clear' }).click();

  await expect(panel).not.toContainText("Musée d'Orsay");
  await expect(page.getByText('Done — day 2 is cleared.')).toBeVisible({ timeout: 30_000 });

  // The confirm card freezes once resolved: the adapter writes the emitted
  // result back onto the local tool call, so the component re-renders into its
  // frozen state — the interactive buttons are gone and a resolved line shows.
  await expect(confirm).toContainText('Day 2 cleared');
  await expect(confirm.getByRole('button', { name: 'Clear' })).toHaveCount(0);
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
});
