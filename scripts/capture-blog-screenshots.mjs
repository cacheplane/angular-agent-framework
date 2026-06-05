// Capture three screenshots for the ag-ui interrupts blog post.
// Drives the running localhost:4320 cockpit example end-to-end.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT_DIR = resolve(
  process.cwd(),
  'apps/website/public/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular',
);
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2, // produce a crisp 2560×1600 png; HTML width/height attrs scale it
});
const page = await context.newPage();

await page.goto('http://localhost:4320', { waitUntil: 'networkidle' });

// Figure 1: welcome screen with the two suggestion chips
await page.getByText('Refund a duplicate charge').waitFor({ timeout: 15_000 });
await page.getByText('Refund a chargeback').waitFor({ timeout: 5_000 });
await page.screenshot({ path: `${OUT_DIR}/1.png`, fullPage: false });
console.log('1.png saved');

// Trigger the interrupt
await page.getByText('Refund a duplicate charge').click();
const dialog = page.locator('dialog.chat-approval-card');
await dialog.waitFor({ state: 'visible', timeout: 45_000 });
// Let the dialog finish animating in
await page.waitForTimeout(800);

// Figure 2: approval card open over the chat
await page.screenshot({ path: `${OUT_DIR}/2.png`, fullPage: false });
console.log('2.png saved');

// Approve and wait for the refund-confirmation message
await dialog.getByRole('button', { name: 'Approve' }).click();
await page.getByText(/Refund of \$/i).waitFor({ timeout: 45_000 });
// Give the message a moment to fully stream in
await page.waitForTimeout(1500);

// Figure 3: post-resume confirmation
await page.screenshot({ path: `${OUT_DIR}/3.png`, fullPage: false });
console.log('3.png saved');

await browser.close();
console.log('done');
