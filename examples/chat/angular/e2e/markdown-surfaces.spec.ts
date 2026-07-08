// SPDX-License-Identifier: MIT
import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  attachBrowserHygiene,
  messageInput,
  openDemo,
  sendButton,
  sendPromptAndWait,
  waitForFinalAssistant,
} from './test-helpers';

test('heading: assistant bubble renders an <h1>', async ({ page }) => {
  const bubble = await sendPromptAndWait(page, 'respond with a heading');
  await expect(bubble.locator('h1')).toBeVisible();
  await expect(bubble.locator('h1')).toContainText(/heading one/i);
});

test('code fence: assistant bubble renders <pre><code>', async ({ page }) => {
  const bubble = await sendPromptAndWait(page, 'respond with a code fence');
  const codeBlock = bubble.locator('pre code');
  await expect(codeBlock).toBeVisible();
  await expect(codeBlock).toContainText('const answer = 42');
});

test('bullet list: assistant bubble renders <ul> with three <li>', async ({ page }) => {
  const bubble = await sendPromptAndWait(page, 'respond with a bullet list');
  const list = bubble.locator('ul');
  await expect(list).toBeVisible();
  await expect(list.locator('li')).toHaveCount(3);
  await expect(list.locator('li').nth(0)).toContainText('alpha');
  await expect(list.locator('li').nth(1)).toContainText('beta');
  await expect(list.locator('li').nth(2)).toContainText('gamma');
});

test('markdown checklist matrix: rich markdown renders with escaped html', async ({ page }) => {
  const bubble = await sendPromptAndWait(page, 'respond with the markdown checklist kitchen sink');

  await expect(bubble.locator('h1')).toContainText('Heading One');
  await expect(bubble.locator('h2')).toContainText('Heading Two');
  await expect(bubble.locator('h3')).toContainText('Heading Three');
  await expect(bubble.locator('strong')).toContainText('bold text');
  await expect(bubble.locator('em')).toContainText('italic text');
  await expect(bubble.locator('p code')).toContainText('inline code');
  await expect(bubble.locator('ul').first()).toContainText('parent item');
  await expect(bubble.locator('ul').first()).toContainText('nested child');
  await expect(bubble.locator('ul').first()).toContainText('second parent');
  await expect(bubble.locator('ol li')).toHaveText(['first ordered', 'second ordered']);
  await expect(bubble.locator('input[type="checkbox"]')).toHaveCount(2);
  await expect(bubble.locator('code').filter({ hasText: 'const answer = 42' })).toBeVisible();
  await expect(bubble.locator('table')).toBeVisible();
  await expect(bubble.locator('thead th')).toHaveText(['Name', 'Mental model', 'When to use']);
  await expect(bubble.locator('tbody tr')).toHaveCount(2);
  await expect.poll(async () => tableColumnsAlign(bubble)).toBe(true);
  await expect(bubble.locator('blockquote')).toBeVisible();
  await expect(bubble).toContainText('This is a blockquote.');
  await expect(bubble.locator('a', { hasText: 'Angular' })).toHaveAttribute(
    'href',
    'https://angular.dev',
  );
  await expect(bubble.locator('hr')).toBeVisible();
  await expect(bubble.locator('script')).toHaveCount(0);
  await expect(bubble).toContainText("<script>alert('xss')</script>");
});

test('streaming markdown table: keeps in-progress rows inside one table', async ({ page }) => {
  const hygiene = attachBrowserHygiene(page);
  await sendPrompt(page, 'stream a markdown comparison table regression');

  const streamingAssistant = latestAssistant(page);
  await expect(streamingAssistant).toBeAttached({ timeout: 15_000 });

  const samples = await collectStreamingSamples(page, streamingAssistant, 2_000);
  expect(contentChangedAcross(samples)).toBe(true);
  const tableSamples = samples.filter((sample) => sample.tableCount > 0);
  expect(tableSamples.length).toBeGreaterThan(2);
  expect(tableSamples.every((sample) => sample.tableCount <= 1)).toBe(true);
  expect(tableSamples.every((sample) => sample.rowsOutsideTable === 0)).toBe(true);
  expect(tableSamples.every((sample) => sample.detachedTableCellText.length === 0)).toBe(true);

  const bubble = await waitForFinalAssistant(page);
  await expect(bubble.locator('table')).toHaveCount(1);
  await expect(bubble.locator('thead th')).toHaveText(['Name', 'Mental model', 'When to use']);
  await expect(bubble.locator('tbody tr')).toHaveCount(3);
  await expect(bubble.locator('tbody tr').nth(2)).toContainText('zone.js');
  await expect.poll(async () => tableColumnsAlign(bubble)).toBe(true);
  expect(hygiene.consoleErrors).toEqual([]);
  expect(hygiene.failedRequests).toEqual([]);
});

test('streaming markdown table: blockquote followed by table does not throw', async ({ page }) => {
  const hygiene = attachBrowserHygiene(page);
  await sendPrompt(page, 'stream a blockquote then a markdown table regression');

  const bubble = await waitForFinalAssistant(page);
  await expect(bubble.locator('blockquote')).toBeVisible();
  await expect(bubble.locator('blockquote')).toContainText('First line of the quote.');
  await expect(bubble.locator('table')).toHaveCount(1);
  await expect(bubble.locator('thead th')).toHaveText([
    'Issue',
    'Expected behavior',
    'Verification',
  ]);
  await expect(bubble.locator('tbody tr')).toHaveCount(2);
  expect(hygiene.consoleErrors).toEqual([]);
  expect(hygiene.failedRequests).toEqual([]);
});

test('streaming code fence: suppresses closing fence marker while streaming', async ({ page }) => {
  const hygiene = attachBrowserHygiene(page);
  await sendPrompt(page, 'stream a TypeScript code fence regression');

  const streamingAssistant = latestAssistant(page);
  await expect(streamingAssistant).toBeAttached({ timeout: 15_000 });

  const samples = await collectStreamingSamples(page, streamingAssistant, 4_000);
  expect(contentChangedAcross(samples)).toBe(true);
  const codeSamples = samples.filter((sample) => sample.codeBlockCount > 0);
  expect(codeSamples.length).toBeGreaterThan(2);
  expect(codeSamples.every((sample) => !sample.hasRawFenceMarker)).toBe(true);

  const bubble = await waitForFinalAssistant(page);
  await expect(bubble.locator('pre code')).toHaveCount(1);
  await expect(bubble.locator('pre code')).toContainText('const answer = 42');
  expect(await bubbleContainsRawFenceMarker(bubble)).toBe(false);
  expect(hygiene.consoleErrors).toEqual([]);
  expect(hygiene.failedRequests).toEqual([]);
});

async function tableColumnsAlign(bubble: Locator): Promise<boolean> {
  const table = bubble.locator('table').first();
  return table.evaluate((el) => {
    const headerCells = Array.from(el.querySelectorAll('thead th'));
    const rows = Array.from(el.querySelectorAll('tbody tr'));
    if (headerCells.length === 0 || rows.length === 0) return false;

    const headerLefts = headerCells.map((cell) => cell.getBoundingClientRect().left);
    return rows.every((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length !== headerLefts.length) return false;
      return cells.every((cell, index) => (
        Math.abs(cell.getBoundingClientRect().left - headerLefts[index]) <= 1
      ));
    });
  });
}

async function sendPrompt(page: Page, prompt: string): Promise<void> {
  await openDemo(page, '/embed');
  await messageInput(page).fill(prompt);
  await sendButton(page).click();
}

function latestAssistant(page: Page): Locator {
  return page.locator('chat-message[data-role="assistant"]').last();
}

interface StreamingMarkdownSample {
  readonly contentTextLength: number;
  readonly tableCount: number;
  readonly rowsOutsideTable: number;
  readonly detachedTableCellText: string[];
  readonly codeBlockCount: number;
  readonly hasRawFenceMarker: boolean;
}

async function collectStreamingSamples(
  page: Page,
  bubble: Locator,
  minimumDurationMs: number,
): Promise<StreamingMarkdownSample[]> {
  const samples: StreamingMarkdownSample[] = [];
  const startedAt = Date.now();

  do {
    samples.push(await sampleStreamingMarkdown(bubble));
    await page.waitForTimeout(75);
  } while (Date.now() - startedAt < minimumDurationMs);

  return samples;
}

async function sampleStreamingMarkdown(bubble: Locator): Promise<StreamingMarkdownSample> {
  return bubble.evaluate((el) => {
    const looksLikeTableRowFragment = (text: string): boolean => (
      /\|/.test(text) || /Angular Signals|RxJS|zone\.js/.test(text)
    );
    const tables = Array.from(el.querySelectorAll('table'));
    const rowsOutsideTable = Array.from(el.querySelectorAll('tr')).filter(
      (row) => !row.closest('table'),
    ).length;
    const detachedTableCellText: string[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      const text = node.textContent?.trim() ?? '';
      if (text && !parent?.closest('table') && looksLikeTableRowFragment(text)) {
        detachedTableCellText.push(text);
      }
      node = walker.nextNode();
    }

    return {
      contentTextLength: el.textContent?.length ?? 0,
      tableCount: tables.length,
      rowsOutsideTable,
      detachedTableCellText,
      codeBlockCount: el.querySelectorAll('pre code').length,
      hasRawFenceMarker: el.textContent?.includes('```') ?? false,
    };
  });
}

async function bubbleContainsRawFenceMarker(bubble: Locator): Promise<boolean> {
  return bubble.evaluate((el) => el.textContent?.includes('```') ?? false);
}

function contentChangedAcross(samples: StreamingMarkdownSample[]): boolean {
  return new Set(samples.map((sample) => sample.contentTextLength)).size > 2;
}
