import { test, expect } from '@playwright/test';

/**
 * jsdom has no layout engine, so the unit tests cannot see a panel that renders
 * into a quarter of its own width — which is exactly what shipped when the
 * Libraries grid's tracks were put on the wrong element. These assertions are
 * about geometry, so they only mean anything in a real browser.
 */
test.describe('desktop nav panels', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
  });

  test('lays the four libraries out side by side, not stacked', async ({ page }) => {
    await page.getByRole('button', { name: 'Libraries' }).click();

    const items = page.locator('.nav-panel .nav-panel-item');
    await expect(items).toHaveCount(5); // four libraries plus the footer link

    const boxes = [];
    for (let index = 0; index < 4; index += 1) {
      const box = await items.nth(index).boundingBox();
      if (!box) throw new Error(`Library item ${index} has no box`);
      boxes.push(box);
    }

    // Four distinct columns: every item starts to the right of the previous one
    // and shares its vertical position.
    for (let index = 1; index < boxes.length; index += 1) {
      expect(boxes[index].x).toBeGreaterThan(boxes[index - 1].x);
      expect(Math.abs(boxes[index].y - boxes[0].y)).toBeLessThanOrEqual(2);
    }

    // And together they occupy most of the panel rather than one track of it.
    const panel = await page.locator('.nav-panel').boundingBox();
    if (!panel) throw new Error('Panel has no box');
    const spanned = boxes[3].x + boxes[3].width - boxes[0].x;
    expect(spanned).toBeGreaterThan(panel.width * 0.8);
  });

  test('stacks the items within each column of a multi-column panel', async ({ page }) => {
    await page.getByRole('button', { name: 'Solutions' }).click();

    const firstColumn = page.locator('.nav-panel .nav-panel-col').first();
    const items = firstColumn.locator('.nav-panel-item');
    await expect(items).toHaveCount(3);

    const first = await items.nth(0).boundingBox();
    const second = await items.nth(1).boundingBox();
    if (!first || !second) throw new Error('Column items have no box');
    expect(second.y).toBeGreaterThan(first.y);
    expect(Math.abs(second.x - first.x)).toBeLessThanOrEqual(2);
  });

  test('draws no borders or dividers inside a panel', async ({ page }) => {
    await page.getByRole('button', { name: 'Docs' }).click();

    const bordered = await page.locator('.nav-panel *').evaluateAll((nodes) =>
      nodes.filter((node) => {
        const style = getComputedStyle(node as Element);
        return (
          parseFloat(style.borderTopWidth) > 0 ||
          parseFloat(style.borderRightWidth) > 0 ||
          parseFloat(style.borderBottomWidth) > 0 ||
          parseFloat(style.borderLeftWidth) > 0
        );
      }).length,
    );
    expect(bordered).toBe(0);
  });
});
