import { test, expect } from '@playwright/test';
import {
  clickInterruptActionAndWaitFinal,
  sendPromptAndWaitForInterrupt,
} from '@threadplane-internal/e2e-harness';

// Matches the welcome suggestion in filesystem.component.ts and the fixture's
// `userMessage` match in e2e/fixtures/da-filesystem.json.
const PROMPT =
  'Work up a runway suitability note for KASE. Save your raw lookups to /notes/kase-data.md, then write the finished note to /reports/kase-runway.md.';

test('da-filesystem: the workspace fills in, the report write pauses, and approving lands it', async ({
  page,
}) => {
  await sendPromptAndWaitForInterrupt(page, PROMPT);

  // `/notes/` is unrestricted, so that write completed and reached the tree as
  // real state — this only renders because the agent runs on StateBackend and
  // its files stream on `values.files`.
  await expect(page.locator('[data-testid="file-row"][data-path="/notes/kase-data.md"]')).toBeVisible();
  await expect(page.getByTestId('file-preview')).toContainText(/7,?820|8,?006|elevation/i);

  // `/reports/**` carries a FilesystemPermission in interrupt mode, so the
  // second write did NOT complete. The tree shows it as a pending ghost row
  // read off the interrupt payload, and no such file exists in state yet.
  const pendingRow = page.locator('[data-testid="file-row"][data-path="/reports/kase-runway.md"]');
  await expect(pendingRow).toHaveAttribute('data-pending', 'true');
  await expect(pendingRow).toContainText('awaiting approval');

  // Two directories, because the ghost row groups under its own prefix.
  await expect(page.locator('[data-testid="file-dir"]')).toHaveCount(2);

  // Approving resumes with { decisions: [{ type: 'approve' }] }; the write then
  // completes and the row stops being pending.
  await clickInterruptActionAndWaitFinal(page, 'Accept');
  await expect(pendingRow).not.toHaveAttribute('data-pending', 'true');
  await expect(page.locator('[data-testid="file-row"]')).toHaveCount(2);
});
