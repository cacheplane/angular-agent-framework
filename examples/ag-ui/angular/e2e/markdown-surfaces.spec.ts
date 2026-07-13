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

test('bullet list: assistant bubble renders <ul> with three <li>', async ({
  page,
}) => {
  const bubble = await sendPromptAndWait(page, 'respond with a bullet list');
  const list = bubble.locator('ul');
  await expect(list).toBeVisible();
  await expect(list.locator('li')).toHaveCount(3);
  await expect(list.locator('li').nth(0)).toContainText('alpha');
  await expect(list.locator('li').nth(1)).toContainText('beta');
  await expect(list.locator('li').nth(2)).toContainText('gamma');
});

test('markdown checklist matrix: rich markdown renders with escaped html', async ({
  page,
}) => {
  const bubble = await sendPromptAndWait(
    page,
    'respond with the markdown checklist kitchen sink'
  );

  await expect(bubble.locator('h1')).toContainText('Heading One');
  await expect(bubble.locator('h2')).toContainText('Heading Two');
  await expect(bubble.locator('h3')).toContainText('Heading Three');
  await expect(bubble.locator('strong')).toContainText('bold text');
  await expect(bubble.locator('em')).toContainText('italic text');
  await expect(bubble.locator('p code')).toContainText('inline code');
  await expect(bubble.locator('ul').first()).toContainText('parent item');
  await expect(bubble.locator('ul').first()).toContainText('nested child');
  await expect(bubble.locator('ul').first()).toContainText('second parent');
  await expect(bubble.locator('ol li')).toHaveText([
    'first ordered',
    'second ordered',
  ]);
  await expect(bubble.locator('input[type="checkbox"]')).toHaveCount(2);
  await expect(
    bubble.locator('code').filter({ hasText: 'const answer = 42' })
  ).toBeVisible();
  await expect(bubble.locator('table')).toBeVisible();
  await expect(bubble.locator('thead th')).toHaveText([
    'Name',
    'Mental model',
    'When to use',
  ]);
  await expect(bubble.locator('tbody tr')).toHaveCount(2);
  await expect(bubble.locator('blockquote')).toBeVisible();
  await expect(bubble).toContainText('This is a blockquote.');
  await expect(bubble.locator('a', { hasText: 'Angular' })).toHaveAttribute(
    'href',
    'https://angular.dev'
  );
  await expect(bubble.locator('hr')).toBeVisible();
  await expect(bubble.locator('script')).toHaveCount(0);
  await expect(bubble).toContainText("<script>alert('xss')</script>");
});

test('streaming markdown table: keeps in-progress rows inside one table', async ({
  page,
}) => {
  const hygiene = attachBrowserHygiene(page);
  await sendPrompt(
    page,
    'stream an AG-UI markdown comparison table regression'
  );

  const streamingAssistant = latestAssistant(page);
  await expect(streamingAssistant).toBeAttached({ timeout: 15_000 });

  const samples = await collectStreamingSamples(
    page,
    streamingAssistant,
    2_000
  );
  expect(
    new Set(samples.map((sample) => sample.contentTextLength)).size
  ).toBeGreaterThan(2);
  const tableSamples = samples.filter((sample) => sample.tableCount > 0);
  expect(tableSamples.length).toBeGreaterThan(2);
  expect(tableSamples.every((sample) => sample.tableCount === 1)).toBe(true);
  expect(tableSamples.every(tableStructureIsValid)).toBe(true);
  expect(
    tableSamples.every((sample) => sample.rawPipeTextOutsideTable.length === 0)
  ).toBe(true);

  const bubble = await waitForFinalAssistant(page);
  await expect(bubble.locator('table')).toHaveCount(1);
  await expect(bubble.locator('thead th')).toHaveText([
    'Name',
    'Mental model',
    'When to use',
  ]);
  await expect(bubble.locator('tbody tr')).toHaveCount(3);
  await expect(bubble.locator('tbody tr').nth(2)).toContainText('zone.js');
  await expect.poll(async () => tableColumnsAlign(bubble)).toBe(true);
  expect(hygiene.consoleErrors).toEqual([]);
  expect(hygiene.failedRequests).toEqual([]);
});

test('streaming markdown table: blockquote boundary remains stable', async ({
  page,
}) => {
  const hygiene = attachBrowserHygiene(page);
  await sendPrompt(page, 'stream an AG-UI blockquote then table regression');

  const streamingAssistant = latestAssistant(page);
  await expect(streamingAssistant).toBeAttached({ timeout: 15_000 });
  await waitForStreamingContent(streamingAssistant);

  const samples = await collectStreamingSamples(
    page,
    streamingAssistant,
    2_000
  );
  expect(
    new Set(samples.map((sample) => sample.contentTextLength)).size
  ).toBeGreaterThan(2);
  const firstTableSample = samples.findIndex((sample) => sample.tableCount > 0);
  expect(firstTableSample).toBeGreaterThanOrEqual(0);
  const tableSamples = samples.slice(firstTableSample);
  expect(tableSamples.length).toBeGreaterThan(2);
  expect(
    tableSamples.every(
      (sample) =>
        sample.tableCount === 1 &&
        tableStructureIsValid(sample) &&
        sample.rawPipeTextOutsideTable.length === 0 &&
        sample.tableFollowsBlockquote &&
        !sample.tableNestedInBlockquote
    )
  ).toBe(true);

  const bubble = await waitForFinalAssistant(page);
  await expect(bubble.locator('blockquote')).toContainText(
    'Second line of the quote.'
  );
  await expect(bubble.locator('table')).toHaveCount(1);
  await expect(bubble.locator('tbody tr')).toHaveCount(2);
  await expect.poll(async () => tableColumnsAlign(bubble)).toBe(true);
  expect(hygiene.consoleErrors).toEqual([]);
  expect(hygiene.failedRequests).toEqual([]);
});

test('streaming markdown table: long header pause does not detach syntax', async ({
  page,
}) => {
  const hygiene = attachBrowserHygiene(page);
  await sendPrompt(
    page,
    'stream an AG-UI markdown table with a long header pause'
  );

  const streamingAssistant = latestAssistant(page);
  await expect(streamingAssistant).toBeAttached({ timeout: 15_000 });
  await waitForStreamingContent(streamingAssistant);

  const samples = await collectStreamingSamples(
    page,
    streamingAssistant,
    2_000
  );
  expect(
    new Set(samples.map((sample) => sample.contentTextLength)).size
  ).toBeGreaterThan(1);
  expect(hasStreamingPauseFollowedByContent(samples, 600)).toBe(true);
  expect(streamingPhaseIsMonotonic(samples)).toBe(true);
  expect(samples.every((sample) => sample.tableCount <= 1)).toBe(true);
  expect(samples.every(tableStructureIsValid)).toBe(true);
  expect(
    samples.every((sample) => sample.rawPipeTextOutsideTable.length === 0)
  ).toBe(true);

  const bubble = await waitForFinalAssistant(page);
  await expect(bubble.locator('table')).toHaveCount(1);
  await expect(bubble.locator('tbody tr')).toHaveCount(2);
  await expect.poll(async () => tableColumnsAlign(bubble)).toBe(true);
  expect(hygiene.consoleErrors).toEqual([]);
  expect(hygiene.failedRequests).toEqual([]);
});

test('streaming code fence: closing marker never renders as text', async ({
  page,
}) => {
  const hygiene = attachBrowserHygiene(page);
  await sendPrompt(page, 'stream an AG-UI TypeScript code fence regression');

  const streamingAssistant = latestAssistant(page);
  await expect(streamingAssistant).toBeAttached({ timeout: 15_000 });

  const samples = await collectStreamingSamples(
    page,
    streamingAssistant,
    2_000
  );
  expect(
    new Set(samples.map((sample) => sample.contentTextLength)).size
  ).toBeGreaterThan(2);
  const firstCodeSample = samples.findIndex(
    (sample) => sample.codeBlockCount > 0
  );
  expect(firstCodeSample).toBeGreaterThanOrEqual(0);
  const samplesAfterCodeAppears = samples.slice(firstCodeSample);
  expect(samplesAfterCodeAppears.length).toBeGreaterThan(2);
  expect(
    samplesAfterCodeAppears.every(
      (sample) => sample.codeBlockCount === 1 && !sample.hasRawFenceMarker
    )
  ).toBe(true);

  const bubble = await waitForFinalAssistant(page);
  await expect(bubble.locator('pre code')).toHaveCount(1);
  await expect(bubble.locator('pre code')).toContainText('const answer = 42');
  await expect(bubble).not.toContainText('```');
  expect(hygiene.consoleErrors).toEqual([]);
  expect(hygiene.failedRequests).toEqual([]);
});

test('streaming thematic break: delimiter never renders as text', async ({
  page,
}) => {
  const hygiene = attachBrowserHygiene(page);
  await sendPrompt(page, 'stream an AG-UI thematic break regression');

  const streamingAssistant = latestAssistant(page);
  await expect(streamingAssistant).toBeAttached({ timeout: 15_000 });
  await waitForStreamingContent(streamingAssistant);

  const samples = await collectStreamingSamples(
    page,
    streamingAssistant,
    1_200
  );
  expect(
    samples.some(
      (sample) => sample.isStreaming && sample.thematicBreakCount > 0
    )
  ).toBe(true);
  expect(
    samples.every(
      (sample) => sample.rawThematicBreakTextOutsideCode.length === 0
    )
  ).toBe(true);

  const bubble = await waitForFinalAssistant(page);
  await expect(bubble.locator('hr')).toHaveCount(1);
  await expect(bubble).toContainText('After the break.');
  expect(hygiene.consoleErrors).toEqual([]);
  expect(hygiene.failedRequests).toEqual([]);
});

async function sendPrompt(page: Page, prompt: string): Promise<void> {
  await openDemo(page, '/');
  await installStreamingMarkdownRecorder(page);
  await messageInput(page).fill(prompt);
  await sendButton(page).click();
}

function latestAssistant(page: Page): Locator {
  return page.locator('chat-message[data-role="assistant"]').last();
}

interface StreamingMarkdownSample {
  readonly capturedAtMs: number;
  readonly isStreaming: boolean;
  readonly contentTextLength: number;
  readonly tableCount: number;
  readonly rowsOutsideTable: number;
  readonly tableElementsOutsideTable: number;
  readonly nonDirectTableRows: number;
  readonly nonDirectTableCells: number;
  readonly tableRowsWithinBounds: boolean;
  readonly rawPipeTextOutsideTable: string[];
  readonly tableFollowsBlockquote: boolean;
  readonly tableNestedInBlockquote: boolean;
  readonly codeBlockCount: number;
  readonly hasRawFenceMarker: boolean;
  readonly thematicBreakCount: number;
  readonly rawThematicBreakTextOutsideCode: string[];
}

interface StreamingMarkdownRecorder {
  readonly samples: StreamingMarkdownSample[];
  capture(element: Element): StreamingMarkdownSample;
}

type BrowserWindow = Window & {
  __streamingMarkdownRecorder?: StreamingMarkdownRecorder;
};

async function installStreamingMarkdownRecorder(page: Page): Promise<void> {
  await page.evaluate(() => {
    const browserWindow = window as BrowserWindow;
    const samples: StreamingMarkdownSample[] = [];
    const capture = (element: Element): StreamingMarkdownSample => {
      const rawPipeTextOutsideTable: string[] = [];
      const rawThematicBreakTextOutsideCode: string[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const text = node.textContent?.trim() ?? '';
        if (
          text.includes('|') &&
          !node.parentElement?.closest('table, pre, code')
        ) {
          rawPipeTextOutsideTable.push(text);
        }
        if (
          !node.parentElement?.closest('pre, code') &&
          /(^|\n)\s*(?:-{3,}|\*{3,}|_{3,})\s*(?=\n|$)/.test(
            node.textContent ?? ''
          )
        ) {
          rawThematicBreakTextOutsideCode.push(text);
        }
        node = walker.nextNode();
      }

      const tables = Array.from(element.querySelectorAll('table'));
      const table = tables[0];
      const blockquote = element.querySelector('blockquote');
      const tableRows = table
        ? Array.from(table.querySelectorAll('tbody tr'))
        : [];
      const directTableRows = table
        ? Array.from(table.querySelectorAll(':scope > tbody > tr'))
        : [];
      const allTableCells = table
        ? Array.from(table.querySelectorAll('tbody tr td'))
        : [];
      const directTableCells = directTableRows.flatMap((row) =>
        Array.from(row.querySelectorAll(':scope > td'))
      );
      const tableRect = table?.getBoundingClientRect();

      return {
        capturedAtMs: performance.now(),
        isStreaming: element.getAttribute('data-streaming') === 'true',
        contentTextLength: element.textContent?.length ?? 0,
        tableCount: tables.length,
        rowsOutsideTable: Array.from(element.querySelectorAll('tr')).filter(
          (row) => !row.closest('table')
        ).length,
        tableElementsOutsideTable: Array.from(
          element.querySelectorAll('tr, th, td')
        ).filter((tableElement) => !tableElement.closest('table')).length,
        nonDirectTableRows: tableRows.length - directTableRows.length,
        nonDirectTableCells: allTableCells.length - directTableCells.length,
        tableRowsWithinBounds: Boolean(
          !table ||
            !tableRect ||
            tableRows.every((row) => {
              const rowRect = row.getBoundingClientRect();
              return (
                rowRect.top >= tableRect.top - 1 &&
                rowRect.bottom <= tableRect.bottom + 1 &&
                rowRect.left >= tableRect.left - 1 &&
                rowRect.right <= tableRect.right + 1
              );
            })
        ),
        rawPipeTextOutsideTable,
        tableFollowsBlockquote: Boolean(
          blockquote &&
            table &&
            Boolean(
              blockquote.compareDocumentPosition(table) &
                Node.DOCUMENT_POSITION_FOLLOWING
            )
        ),
        tableNestedInBlockquote: Boolean(table?.closest('blockquote')),
        codeBlockCount: element.querySelectorAll('pre code').length,
        hasRawFenceMarker: element.textContent?.includes('```') ?? false,
        thematicBreakCount: element.querySelectorAll('hr').length,
        rawThematicBreakTextOutsideCode,
      };
    };

    browserWindow.__streamingMarkdownRecorder = { samples, capture };
    const observer = new MutationObserver(() => {
      const assistants = document.querySelectorAll(
        'chat-message[data-role="assistant"]'
      );
      const assistant = assistants.item(assistants.length - 1);
      if (assistant) samples.push(capture(assistant));
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-streaming'],
      characterData: true,
      childList: true,
      subtree: true,
    });
    window.setInterval(() => {
      const assistants = document.querySelectorAll(
        'chat-message[data-role="assistant"][data-streaming="true"]'
      );
      const assistant = assistants.item(assistants.length - 1);
      if (assistant) samples.push(capture(assistant));
    }, 25);
  });
}

async function collectStreamingSamples(
  page: Page,
  bubble: Locator,
  minimumDurationMs: number
): Promise<StreamingMarkdownSample[]> {
  await page.waitForTimeout(minimumDurationMs);
  await sampleStreamingMarkdown(bubble);
  return page.evaluate(() => [
    ...((window as BrowserWindow).__streamingMarkdownRecorder?.samples ?? []),
  ]);
}

async function waitForStreamingContent(bubble: Locator): Promise<void> {
  await expect
    .poll(
      async () => (await sampleStreamingMarkdown(bubble)).contentTextLength,
      { intervals: [25], timeout: 15_000 }
    )
    .toBeGreaterThan(0);
}

async function sampleStreamingMarkdown(
  bubble: Locator
): Promise<StreamingMarkdownSample> {
  return bubble.evaluate((element) => {
    const recorder = (window as BrowserWindow).__streamingMarkdownRecorder;
    if (!recorder)
      throw new Error('Streaming markdown recorder is not installed');
    const sample = recorder.capture(element);
    recorder.samples.push(sample);
    return sample;
  });
}

function tableStructureIsValid(sample: StreamingMarkdownSample): boolean {
  return (
    sample.rowsOutsideTable === 0 &&
    sample.tableElementsOutsideTable === 0 &&
    sample.nonDirectTableRows === 0 &&
    sample.nonDirectTableCells === 0 &&
    sample.tableRowsWithinBounds
  );
}

function hasStreamingPauseFollowedByContent(
  samples: StreamingMarkdownSample[],
  minimumPauseMs: number
): boolean {
  for (let start = 0; start < samples.length; start += 1) {
    const first = samples[start];
    if (!first?.isStreaming || first.contentTextLength === 0) continue;

    let end = start;
    while (
      samples[end + 1]?.isStreaming &&
      samples[end + 1]?.contentTextLength === first.contentTextLength
    ) {
      end += 1;
    }

    const last = samples[end];
    const laterContentArrived = samples
      .slice(end + 1)
      .some(
        (sample) =>
          sample.isStreaming &&
          sample.contentTextLength > first.contentTextLength
      );
    if (
      last.capturedAtMs - first.capturedAtMs > minimumPauseMs &&
      laterContentArrived
    ) {
      return true;
    }

    start = end;
  }
  return false;
}

function streamingPhaseIsMonotonic(
  samples: StreamingMarkdownSample[]
): boolean {
  const firstStreamingSample = samples.findIndex(
    (sample) => sample.isStreaming
  );
  if (firstStreamingSample < 0) return false;

  const firstFinalSample = samples.findIndex(
    (sample, index) => index > firstStreamingSample && !sample.isStreaming
  );
  return (
    firstFinalSample < 0 ||
    samples.slice(firstFinalSample + 1).every((sample) => !sample.isStreaming)
  );
}

async function tableColumnsAlign(bubble: Locator): Promise<boolean> {
  const table = bubble.locator('table').first();
  return table.evaluate((element) => {
    const headerCells = Array.from(element.querySelectorAll('thead th'));
    const rows = Array.from(element.querySelectorAll('tbody tr'));
    if (headerCells.length === 0 || rows.length === 0) return false;

    const headerLefts = headerCells.map(
      (cell) => cell.getBoundingClientRect().left
    );
    return rows.every((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length !== headerLefts.length) return false;
      return cells.every(
        (cell, index) =>
          Math.abs(cell.getBoundingClientRect().left - headerLefts[index]) <= 1
      );
    });
  });
}
