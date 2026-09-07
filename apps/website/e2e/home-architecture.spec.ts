import { test, expect, type Page } from '@playwright/test';
import { CARDS, diagramHrefs } from '../src/lib/architecture-diagram';

const DIAGRAM = '[data-diagram="enterprise-architecture"]';

/**
 * Measures every rendered text run and chip in the diagram against the card
 * that owns it, in viewBox units (getBBox reports user space, so the numbers
 * compare directly with lib/architecture-diagram.ts). The unit spec proves
 * the boxes are on the grid; this proves the type set inside them fits.
 */
async function overflowReport(page: Page) {
  return page.evaluate((sel) => {
    const issues: string[] = [];
    for (const a of document.querySelectorAll<SVGElement>(
      `${sel} [data-card]`
    )) {
      const g = a.querySelector<SVGGElement>('[data-card-rect]');
      if (!g) continue;
      const cx = +g.dataset['x']!;
      const cy = +g.dataset['y']!;
      const cw = +g.dataset['w']!;
      const ch = +g.dataset['h']!;
      for (const t of a.querySelectorAll<SVGTextElement>('text')) {
        const b = t.getBBox();
        if (
          b.x < cx + 6 ||
          b.x + b.width > cx + cw - 6 ||
          b.y < cy + 4 ||
          b.y + b.height > cy + ch - 4
        ) {
          issues.push(
            `${a.dataset['card']}: "${t.textContent?.slice(
              0,
              40
            )}" ${Math.round(b.x)}..${Math.round(b.x + b.width)} vs ${cx}..${
              cx + cw
            }`
          );
        }
      }
      for (const r of a.querySelectorAll<SVGRectElement>('[data-chip] rect')) {
        const b = r.getBBox();
        if (b.x + b.width > cx + cw - 6 || b.y + b.height > cy + ch - 8) {
          issues.push(`${a.dataset['card']}: chip past the card edge`);
        }
      }
    }
    const images = [
      ...document.querySelectorAll<SVGImageElement>(`${sel} image`),
    ].map((i) => i.getBBox().width);
    return { issues, images };
  }, DIAGRAM);
}

test.describe('homepage architecture', () => {
  test('replaces the scope table, links every card to its docs page, and keeps every text run inside its card', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('#architecture-heading')).toHaveText(
      'The UI layer between your users and your agents.'
    );
    await expect(page.locator('#why-heading')).toHaveCount(0);
    const cards = page.locator(`${DIAGRAM} [data-card]`);
    await expect(cards).toHaveCount(CARDS.length);
    for (const c of CARDS) {
      const card = page.locator(`${DIAGRAM} [data-card="${c.id}"]`);
      const link =
        (await card.evaluate((el) => el.tagName.toLowerCase())) === 'a'
          ? card
          : card.locator('a.arch-title-link');
      await expect(link).toHaveAttribute('href', c.href);
    }
    const hrefs = await page
      .locator(`${DIAGRAM} a[href]`)
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    for (const href of diagramHrefs()) expect(hrefs).toContain(href);

    // Fonts must be loaded before measuring, or a fallback face lies about widths.
    await page.evaluate(() => document.fonts.ready);
    const report = await overflowReport(page);
    expect(report.issues, report.issues.join('\n')).toEqual([]);
    expect(report.images.length).toBeGreaterThanOrEqual(15);
    for (const w of report.images) expect(w).toBeGreaterThan(0);
  });

  test('stacks the same cards on a phone instead of scrolling the drawing sideways', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const stack = page.locator(`${DIAGRAM} [data-arch-stack]`);
    await stack.scrollIntoViewIfNeeded();
    await expect(stack).toBeVisible();
    await expect(page.locator(`${DIAGRAM} .tp-diagram-figure`)).toBeHidden();
    await expect(stack.locator('a.arch-stack-card')).toHaveCount(CARDS.length);
    const wide = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(wide, 'no horizontal page scroll on a phone').toBe(false);
  });
});
