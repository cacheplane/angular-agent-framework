import { test, expect, type Page } from '@playwright/test';

const BAND = '#no-runtime';

/**
 * The unit spec proves the flows are drawn from the copy module; this proves
 * the drawing holds together in a real layout. Measured, not eyeballed: every
 * node in a flow shares that flow's centre line, no node's text overflows its
 * box, and on a phone the flows stack instead of squeezing.
 */
async function nodeReport(page: Page) {
  return page.evaluate((sel) => {
    const flows = Array.from(document.querySelectorAll<HTMLElement>(`${sel} [data-flow]`));
    return flows.map((flow) => {
      const nodes = Array.from(flow.querySelectorAll<HTMLElement>('.no-runtime-node'));
      return {
        id: flow.dataset['flow'],
        top: flow.getBoundingClientRect().top,
        centres: nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return Math.round((r.left + r.right) / 2);
        }),
        overflowing: nodes.filter((n) => n.scrollWidth > n.clientWidth).map((n) => n.textContent),
      };
    });
  }, BAND);
}

test.describe('homepage No-runtime band', () => {
  test('aligns every node on its flow centre line and clips no text at 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('#no-runtime-heading')).toHaveText('No runtime.');
    await page.locator(BAND).scrollIntoViewIfNeeded();
    const flows = await nodeReport(page);
    expect(flows.map((f) => f.id)).toEqual(['usual', 'ours']);
    for (const f of flows) {
      expect(f.overflowing, f.id).toEqual([]);
      expect(new Set(f.centres).size, `${f.id} centres ${f.centres.join(',')}`).toBe(1);
    }
    // Side by side: the two flows share a top edge.
    expect(Math.abs(flows[0].top - flows[1].top)).toBeLessThanOrEqual(1);
    // The ghost hop exists exactly once and only in the usual flow.
    await expect(page.locator(`${BAND} .no-runtime-node.is-ghost`)).toHaveCount(1);
    await expect(page.locator(`${BAND} [data-flow="ours"] .is-ghost`)).toHaveCount(0);
  });

  test('stacks the flows and still fits every node on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.locator(BAND).scrollIntoViewIfNeeded();
    const flows = await nodeReport(page);
    for (const f of flows) {
      expect(f.overflowing, f.id).toEqual([]);
      expect(new Set(f.centres).size).toBe(1);
    }
    // Stacked: the ours flow starts below the usual one.
    expect(flows[1].top).toBeGreaterThan(flows[0].top + 100);
    // The page never scrolls sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('carries one link, to the adapter guide, and no button', async ({ page }) => {
    await page.goto('/');
    const links = page.locator(`${BAND} a`);
    await expect(links).toHaveCount(1);
    await expect(links).toHaveAttribute('href', '/docs/choosing-an-adapter');
    await expect(page.locator(`${BAND} [data-ui="button"]`)).toHaveCount(0);
  });
});
