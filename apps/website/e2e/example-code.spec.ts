import { test, expect } from '@playwright/test';

/**
 * `<ExampleCode>` renders a docs page's example file through the docs code
 * pipeline. jsdom proves the element tree; only a browser proves that the
 * fence was highlighted, that the title bar is visible, and that the copy
 * button copies the example source rather than the title or the markers.
 */
test.describe('ExampleCode on a docs page', () => {
  const route = '/docs/langgraph/guides/streaming';
  const file =
    'cockpit/langgraph/streaming/angular/src/app/streaming.component.ts';

  test('renders a highlighted, titled, copyable block from the example file', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(route);

    const block = page
      .locator(`.mdx-example-code[data-example-file="${file}"]`)
      .first();
    await expect(block).toBeVisible();
    await expect(block.locator('.mdx-example-code-title')).toHaveText(
      'streaming.component.ts'
    );
    await expect(block).toHaveAttribute('role', 'group');

    // Highlighted: shiki emits per-token spans with inline colour.
    const pre = block.locator('pre').first();
    await expect(pre).toBeVisible();
    expect(await pre.locator('span[style*="color"]').count()).toBeGreaterThan(
      10
    );
    await expect(pre).toContainText('export class StreamingComponent');

    // Copy: the button copies the code, not the title bar.
    await block.locator('button[aria-label="Copy code"]').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('export class StreamingComponent');
    expect(copied).not.toContain('streaming.component.ts\n');
  });
});
