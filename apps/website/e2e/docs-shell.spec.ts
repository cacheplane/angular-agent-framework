import { test, expect } from '@playwright/test';

const ARTICLE = '/docs/langgraph/getting-started/introduction';

async function expectWorkspaceReady(page: import('@playwright/test').Page) {
  await expect(page.locator('[data-workspace-shell]')).toHaveAttribute(
    'data-hydrated',
    'true',
  );
}

/**
 * The docs shell is one reading pane: a sticky control plane on the left, one
 * prose column, and a sticky TOC rail on the right. These guard the parts of
 * that whose failure mode is silence — a rail that stops tracking, a column
 * that stops sharing its measure — and which jsdom cannot see.
 */

test.describe('DocsTOC rail', () => {
  test('tracks the reading position on a hard load', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(ARTICLE);
    await expectWorkspaceReady(page);
    await expect(page.locator('.docs-toc-link').first()).toBeVisible();

    // Nothing is active at the top: the first heading is below the reading line.
    await expect(page.locator('.docs-toc-link[data-active]')).toHaveCount(0);

    const articleScroller = page.locator('.docs-workspace-article');
    await articleScroller.evaluate((element) =>
      element.scrollTo({ top: 4000, behavior: 'instant' }),
    );
    await expect
      .poll(() =>
        page
          .locator('.docs-toc-link[data-active]')
          .evaluateAll((els) => els.map((e) => e.getAttribute('href'))),
      )
      .toEqual(['#connect-with-angular']);

    // ...and it follows the scroll rather than latching on the first match.
    await articleScroller.evaluate((element) =>
      element.scrollTo({ top: 0, behavior: 'instant' }),
    );
    await expect.poll(() => page.locator('.docs-toc-link[data-active]').count()).toBe(0);
  });

  test('every rail link resolves to a heading in the article', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(ARTICLE);

    const unresolved = await page.evaluate(() =>
      [...document.querySelectorAll('.docs-toc-link')]
        .map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? '')
        .filter((href) => !document.getElementById(href.slice(1))),
    );
    expect(unresolved).toEqual([]);
  });

  test('the library-neutral adapter page gets the same rail', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/docs/choosing-an-adapter');
    await expect(page.locator('.docs-toc')).toBeVisible();
    expect(await page.locator('.docs-toc-link').count()).toBeGreaterThan(3);
  });
});

test.describe('docs shell layout', () => {
  test('the workspace navigation and TOC hold through a full article scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(ARTICLE);
    await expectWorkspaceReady(page);

    const navH = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')),
    );
    const tops = async () => ({
      plane: await page.locator('[data-cockpit-desktop-navigation]').evaluate((el) => Math.round(el.getBoundingClientRect().top)),
      toc: await page.locator('.docs-toc').evaluate((el) => Math.round(el.getBoundingClientRect().top)),
    });

    const initial = await tops();
    const articleScroller = page.locator('.docs-workspace-article');

    expect(initial.plane).toBe(navH);
    expect(initial.toc).toBeGreaterThan(navH);
    await articleScroller.evaluate((element) =>
      element.scrollTo({ top: 4000, behavior: 'instant' }),
    );
    expect(await tops()).toEqual(initial);
    await articleScroller.evaluate((element) =>
      element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }),
    );
    expect(await tops()).toEqual(initial);
  });

  test('breadcrumb, prose and prev/next share one right edge', async ({ page }) => {
    // The header block used to stretch to the full content width while the
    // article and the prev/next rail sat at max-w-3xl, so PageActions floated
    // ~500px right of the column it belongs to.
    await page.setViewportSize({ width: 1920, height: 1000 });
    await page.goto(ARTICLE);
    await expectWorkspaceReady(page);
    const docsPanel = page.getByRole('region', { name: 'Docs workspace panel' });

    const right = (selector: string) =>
      docsPanel.locator(selector).evaluate((el) => Math.round(el.getBoundingClientRect().right));

    const header = await right('.docs-page-header');
    const article = await right('article');
    const prevNext = await right('.docs-prevnext');

    // The header and prev/next sit inside the article's horizontal padding.
    expect(article - header).toBeLessThanOrEqual(48);
    expect(header).toBe(prevNext);
  });
});
