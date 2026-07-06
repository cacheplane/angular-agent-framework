// SPDX-License-Identifier: MIT
import { test, expect, type Locator } from '@playwright/test';
import { sendPromptAndWait } from './test-helpers';

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
