// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '@threadplane-internal/e2e-harness';

// Matches the welcome suggestion in planning.component.ts and the fixture's
// `userMessage` match in e2e/fixtures/da-planning.json.
const PROMPT =
  'Plan a dispatch brief for a flight from KSFO to KASE: check field elevation, runway length, and weather at both ends, then tell me if there is anything the crew should know.';

test('da-planning: the todo list renders and its rows move off pending', async ({ page }) => {
  const bubble = await submitAndWaitForResponse(page, PROMPT);

  // The panel is a pure projection of `state.todos`, which only exists because
  // TodoListMiddleware is installed and the model called `write_todos`. Four
  // rows is the plan the recorded run wrote.
  const rows = page.locator('[data-testid="todo-row"]');
  await expect(rows).toHaveCount(4);

  // The differentiated assertion: statuses actually advanced. The recorded run
  // finishes the first three steps and leaves the summary step in progress, so
  // nothing is left at `pending` and the completed count is non-zero. A graph
  // that emitted a static list, or a panel that ignored `status`, fails here.
  await expect(page.locator('[data-testid="todo-row"][data-status="completed"]')).toHaveCount(3);
  await expect(page.locator('[data-testid="todo-row"][data-status="in_progress"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="todo-row"][data-status="pending"]')).toHaveCount(0);
  await expect(page.getByTestId('todo-progress')).toHaveText('3 of 4 complete');

  // The plan text came from the agent, not from the component.
  await expect(rows.first()).toContainText(/elevation/i);

  const finalText = await bubble.innerText();
  expect(finalText.toLowerCase()).toMatch(/ksfo|kase|runway|elevation|weather/);
});
