/**
 * Refresh whitepaper PDF covers without regenerating chapter content.
 *
 * The chapter prose in apps/website/public/whitepaper-preview.html and
 * apps/website/public/whitepapers/*-preview.html is LLM-generated and
 * acceptable as-is. Only the cover styling needs to match the new
 * Statusbrew aesthetic (PR #277 updated the source script; this refreshes
 * the rendered artifacts surgically without needing ANTHROPIC_API_KEY).
 *
 * What it does:
 * 1. For each preview HTML, find/replace the legacy 4-stop pastel cover
 *    gradient with a per-paper subtle 2-stop tint matching the new tokens.
 * 2. Update the cover footer color (#888 → #8b8fa3 / textMuted).
 * 3. Update TOC row colors (rgba(0,0,0,.06) → #e6e8ee / border;
 *    #444 → #555770 / textSecondary).
 * 4. Write the updated HTML back.
 * 5. Render to PDF using Puppeteer.
 *
 * Usage:
 *   pnpm tsx apps/website/scripts/refresh-whitepaper-covers.ts
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import puppeteer from 'puppeteer';

interface Paper {
  /** Per-paper cover gradient (matches the source updated in PR #277). */
  newGradient: string;
  htmlPath: string;
  pdfPath: string;
}

const ROOT = join(process.cwd(), 'apps', 'website', 'public');

const PAPERS: Paper[] = [
  {
    newGradient: 'linear-gradient(135deg, #fafbfc 0%, #eaf3ff 100%)',
    htmlPath: join(ROOT, 'whitepaper-preview.html'),
    pdfPath: join(ROOT, 'whitepaper.pdf'),
  },
  {
    newGradient: 'linear-gradient(135deg, #fafbfc 0%, #eaf3ff 100%)',
    htmlPath: join(ROOT, 'whitepapers', 'angular-preview.html'),
    pdfPath: join(ROOT, 'whitepapers', 'angular.pdf'),
  },
  {
    newGradient: 'linear-gradient(135deg, #fafbfc 0%, #e8f5e9 100%)',
    htmlPath: join(ROOT, 'whitepapers', 'render-preview.html'),
    pdfPath: join(ROOT, 'whitepapers', 'render.pdf'),
  },
  {
    newGradient: 'linear-gradient(135deg, #fafbfc 0%, #f3e8ff 100%)',
    htmlPath: join(ROOT, 'whitepapers', 'chat-preview.html'),
    pdfPath: join(ROOT, 'whitepapers', 'chat.pdf'),
  },
];

const LEGACY_GRADIENT_RE =
  /background:linear-gradient\(135deg,\s*#[0-9a-fA-F]+\s+0%,\s*#[0-9a-fA-F]+\s+45%,\s*#[0-9a-fA-F]+\s+70%,\s*#[0-9a-fA-F]+\s+100%\)/;

function refreshHtml(html: string, paper: Paper): string {
  let out = html;

  if (LEGACY_GRADIENT_RE.test(out)) {
    out = out.replace(LEGACY_GRADIENT_RE, `background:${paper.newGradient}`);
  }

  // Cover footer: #888 → #8b8fa3 (textMuted)
  out = out.replace(/font-size:13px;color:#888/g, 'font-size:13px;color:#8b8fa3');

  // TOC row: rgba(0,0,0,.06) border → #e6e8ee (border token); #444 text → #555770 (textSecondary)
  out = out.replace(
    /border-bottom:1px solid rgba\(0,0,0,\.06\);font-size:15px;color:#444/g,
    'border-bottom:1px solid #e6e8ee;font-size:15px;color:#555770',
  );

  return out;
}

async function renderPdf(htmlPath: string, pdfPath: string): Promise<void> {
  const html = await readFile(htmlPath, 'utf8');
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  for (const paper of PAPERS) {
    console.log(`\n— ${paper.htmlPath}`);
    const original = await readFile(paper.htmlPath, 'utf8');
    const refreshed = refreshHtml(original, paper);
    if (refreshed === original) {
      console.log('  (no changes — already on new aesthetic)');
    } else {
      await writeFile(paper.htmlPath, refreshed, 'utf8');
      console.log('  HTML refreshed');
    }
    await renderPdf(paper.htmlPath, paper.pdfPath);
    console.log(`  PDF rendered → ${paper.pdfPath}`);
  }
  console.log('\n✓ All 4 whitepaper covers refreshed.');
}

main().catch((err) => {
  console.error('Refresh failed:', err);
  process.exit(1);
});
