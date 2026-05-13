/**
 * Capture product screenshots from the live cockpit demo
 * for use in the marketing site's BrowserFrame placeholders.
 *
 * Captures cockpit.cacheplane.ai in each of its 4 modes (Run, Code,
 * Docs, API) at 2× DPR, then crops the cockpit content well, optimizes
 * to WebP, and writes to apps/website/public/screenshots/.
 *
 * Usage:
 *   pnpm tsx apps/website/scripts/capture-screenshots.ts
 *
 * Optional flags:
 *   --url <url>    Override the cockpit URL (default cockpit.cacheplane.ai)
 *   --keep-png     Keep the intermediate PNG files (for debugging)
 *
 * The script is idempotent — it overwrites existing files in
 * apps/website/public/screenshots/. The output WebP files are committed
 * to the repo so the marketing site can use them at build time without
 * needing this script to run.
 */
import { chromium, type Page } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const DEFAULT_COCKPIT_URL =
  'https://cockpit.cacheplane.ai/langgraph/core-capabilities/streaming/overview/python';

interface CaptureTarget {
  /** Output filename (without extension). */
  name: string;
  /** Cockpit mode to switch to before capturing. */
  mode: 'Run' | 'Code' | 'Docs' | 'API';
  /**
   * Selector for the element to capture. If omitted, captures the cockpit
   * content section (everything except the sidebar) at full size.
   */
  selector?: string;
  /** Additional wait after mode click before screenshotting (ms). */
  settleMs?: number;
}

const TARGETS: CaptureTarget[] = [
  // Hero collage back frame + Stream FeatureBlock + Pilot "Build" block.
  // The "Run" mode shows the live chat surface — captures real product UI.
  { name: 'cockpit-run', mode: 'Run', settleMs: 4000 },
  // Hero collage front frame replacement — Code mode shows the agent
  // source code in a tabbed code panel.
  { name: 'cockpit-code', mode: 'Code', settleMs: 1500 },
  // Render FeatureBlock visual — Docs mode shows narrative documentation
  // (well-structured content, looks like rendered output).
  { name: 'cockpit-docs', mode: 'Docs', settleMs: 1500 },
  // API mode shows the API reference renderer — useful alternative
  // for the Render block visual.
  { name: 'cockpit-api', mode: 'API', settleMs: 1500 },
];

interface Args {
  url: string;
  keepPng: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const out: Args = { url: DEFAULT_COCKPIT_URL, keepPng: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && i + 1 < args.length) {
      out.url = args[++i];
    } else if (args[i] === '--keep-png') {
      out.keepPng = true;
    }
  }
  return out;
}

async function ensureDir(path: string): Promise<void> {
  if (!existsSync(path)) await mkdir(path, { recursive: true });
}

async function switchMode(page: Page, mode: CaptureTarget['mode']): Promise<void> {
  // Cockpit's ModeSwitcher renders buttons with the mode name as text.
  // Target the exact button by accessible name.
  const button = page.getByRole('button', { name: mode, exact: true });
  await button.waitFor({ state: 'visible', timeout: 10_000 });
  await button.click();
}

async function captureOne(
  page: Page,
  target: CaptureTarget,
  outputDir: string,
  keepPng: boolean,
): Promise<{ png: string; webp: string }> {
  console.log(`  → switching to ${target.mode} mode`);
  await switchMode(page, target.mode);

  const settle = target.settleMs ?? 1500;
  console.log(`  → waiting ${settle}ms for content to settle`);
  await page.waitForTimeout(settle);

  // Capture the cockpit content section (not the sidebar — we want the
  // mode content visible at the top, not the sidebar nav).
  const locator = target.selector
    ? page.locator(target.selector)
    : page.locator('main[aria-label="Cockpit shell"] section').first();

  const pngPath = join(outputDir, `${target.name}.png`);
  const webpPath = join(outputDir, `${target.name}.webp`);

  console.log(`  → screenshotting → ${target.name}.png`);
  await locator.screenshot({ path: pngPath, type: 'png' });

  console.log(`  → optimizing → ${target.name}.webp`);
  await sharp(pngPath)
    .resize({ width: 1400, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(webpPath);

  if (!keepPng) await unlink(pngPath);

  return { png: pngPath, webp: webpPath };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const outputDir = join(process.cwd(), 'apps/website/public/screenshots');
  await ensureDir(outputDir);

  console.log(`Capturing cockpit screenshots from: ${args.url}`);
  console.log(`Output: ${outputDir}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    console.log(`Loading cockpit at ${args.url}`);
    await page.goto(args.url, { waitUntil: 'networkidle', timeout: 30_000 });

    // Wait for cockpit shell to hydrate.
    await page.waitForSelector('[data-hydrated="true"]', { timeout: 15_000 });
    console.log('Cockpit hydrated ✓\n');

    for (const target of TARGETS) {
      console.log(`Capturing: ${target.name}`);
      await captureOne(page, target, outputDir, args.keepPng);
      console.log('');
    }

    console.log('✓ All screenshots captured.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
