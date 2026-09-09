import { test, expect, type Page } from '@playwright/test';
import {
  CONCOURSES,
  GATES_A,
  GATES_B,
  MAIN,
  NEAT,
  PROVIDERS,
  VIEW,
} from '../src/lib/airport-diagram';

const PLATE = '[data-diagram="airport"]';
const STAND_COUNT = GATES_A.length + GATES_B.length;
const NEAT_BOTTOM = NEAT.y + NEAT.height;

/**
 * The concourse table, flattened to something structured-cloneable so the
 * browser side can compare rendered type against the very constants the
 * component drew from. Only the fields the measurements need.
 */
const CONCOURSE_BOXES = CONCOURSES.map((c) => ({
  id: c.id,
  label: c.label,
  x0: c.box.x0,
  x1: c.box.x1,
  y0: c.box.y0,
  y1: c.box.y1,
}));

/**
 * Measures the rendered plate against lib/airport-diagram.ts. getBBox reports
 * user space, so a containment check inside one coordinate system — text
 * inside the concourse that owns it, a mark inside its stand, a taxiway
 * against the main terminal — compares directly with the module's numbers.
 *
 * Overlap between two elements that do NOT share a coordinate system is the
 * exception: the airfield sits at a heading and every stand counter-rotates
 * about its own centre, so an axis-aligned box in one space is a tilted
 * quadrilateral in another. Those comparisons transform each bbox's four
 * corners into the root's user space and separate the quads properly, because
 * an axis-aligned bound around tilted type reports collisions that are not
 * there.
 *
 * Designing this band produced four collisions that only a human eye caught:
 * gate numbers over package labels, a taxiway through the main terminal,
 * sub-labels below a 26px concourse, and the scale bar on top of runway 09R.
 * Every check here is one of those, generalised.
 */
async function overflowReport(page: Page) {
  return page.evaluate(
    ({ sel, concourses, main, neatBottom }) => {
      const issues: string[] = [];
      const svg = document.querySelector<SVGSVGElement>(sel);
      if (!svg) return ['the airport plate is not on the page'];

      const r2 = (n: number) => Math.round(n * 10) / 10;
      const box = (el: SVGGraphicsElement) => el.getBBox();
      const rect = (b: DOMRect | SVGRect) => ({
        x0: b.x,
        y0: b.y,
        x1: b.x + b.width,
        y1: b.y + b.height,
      });
      const label = (el: Element) => {
        const cls = el.getAttribute('class');
        return cls ? `${el.tagName}.${cls}` : el.tagName;
      };

      type Pt = { x: number; y: number };

      /** The element's bbox as four corners in the plate's own user space. */
      const rootCTM = svg.getScreenCTM();
      if (!rootCTM) return ['the airport plate is not being rendered'];
      const toRoot = rootCTM.inverse();
      const quad = (el: SVGGraphicsElement): Pt[] | null => {
        const ctm = el.getScreenCTM();
        if (!ctm) return null;
        const m = toRoot.multiply(ctm);
        const b = el.getBBox();
        const p = (x: number, y: number) =>
          new DOMPoint(x, y).matrixTransform(m);
        return [
          p(b.x, b.y),
          p(b.x + b.width, b.y),
          p(b.x + b.width, b.y + b.height),
          p(b.x, b.y + b.height),
        ];
      };

      /** Separating-axis test on two convex quads. Touching is not overlapping. */
      const quadsOverlap = (a: Pt[], b: Pt[]) => {
        for (const poly of [a, b]) {
          for (let i = 0; i < poly.length; i += 1) {
            const p0 = poly[i];
            const p1 = poly[(i + 1) % poly.length];
            const nx = -(p1.y - p0.y);
            const ny = p1.x - p0.x;
            let aMin = Infinity;
            let aMax = -Infinity;
            let bMin = Infinity;
            let bMax = -Infinity;
            for (const v of a) {
              const d = v.x * nx + v.y * ny;
              aMin = Math.min(aMin, d);
              aMax = Math.max(aMax, d);
            }
            for (const v of b) {
              const d = v.x * nx + v.y * ny;
              bMin = Math.min(bMin, d);
              bMax = Math.max(bMax, d);
            }
            if (aMax <= bMin || bMax <= aMin) return false;
          }
        }
        return true;
      };

      // 1. Concourse type stays inside the building that names it. The first
      //    draft put an 8.5px sub-label 33 units down a 26-unit-tall concourse,
      //    so it rendered below the building entirely.
      for (const c of concourses) {
        const g = document.querySelector<SVGGElement>(
          `${sel} [data-concourse="${c.id}"]`
        );
        if (!g) {
          issues.push(`concourse ${c.id}: not rendered`);
          continue;
        }
        for (const t of g.querySelectorAll<SVGTextElement>('text')) {
          const b = rect(box(t));
          if (b.x0 < c.x0 || b.x1 > c.x1 || b.y0 < c.y0 || b.y1 > c.y1) {
            issues.push(
              `concourse ${c.id}: "${t.textContent}" at ${r2(b.x0)},${r2(
                b.y0
              )}..${r2(b.x1)},${r2(b.y1)} escapes ${c.x0},${c.y0}..${c.x1},${
                c.y1
              }`
            );
          }
        }

        // 2. The name plate is sized by a font-metric estimate
        //    (6.6 * label.length + 13), so nothing but this holds it to the
        //    type it is supposed to knock out. A type change breaks it
        //    silently otherwise.
        const plate = g.querySelector<SVGRectElement>('.ap-conc-plate');
        const name = g.querySelector<SVGTextElement>('.ap-conc-label');
        if (!plate || !name) {
          issues.push(`concourse ${c.id}: missing name plate or label`);
          continue;
        }
        const p = rect(box(plate));
        const n = rect(box(name));
        if (n.x0 < p.x0 || n.x1 > p.x1 || n.y0 < p.y0 || n.y1 > p.y1) {
          issues.push(
            `concourse ${c.id}: "${name.textContent}" at ${r2(n.x0)},${r2(
              n.y0
            )}..${r2(n.x1)},${r2(n.y1)} is not backed by its plate ${r2(
              p.x0
            )},${r2(p.y0)}..${r2(p.x1)},${r2(p.y1)}`
          );
        }
      }

      // 3. Every mark sits inside the stand box it is parked on. Both live in
      //    the stand's counter-rotated group, so the bboxes share a space.
      for (const s of document.querySelectorAll<SVGGElement>(
        `${sel} [data-stand]`
      )) {
        const gate = s.dataset['stand'];
        const b = s.querySelector<SVGRectElement>('[data-stand-box]');
        const img = s.querySelector<SVGImageElement>('image');
        if (!b || !img) {
          issues.push(`stand ${gate}: missing box or mark`);
          continue;
        }
        const bb = rect(box(b));
        const mm = rect(box(img));
        if (mm.x0 < bb.x0 || mm.y0 < bb.y0 || mm.x1 > bb.x1 || mm.y1 > bb.y1) {
          issues.push(
            `stand ${gate}: mark ${r2(mm.x0)},${r2(mm.y0)}..${r2(mm.x1)},${r2(
              mm.y1
            )} escapes its box ${r2(bb.x0)},${r2(bb.y0)}..${r2(bb.x1)},${r2(
              bb.y1
            )}`
          );
        }
      }

      // 4. No two text runs anywhere on the plate may overlap — the gate
      //    numbers over the package labels, generalised to every pair.
      const texts: { el: SVGTextElement; q: Pt[] }[] = [];
      for (const t of document.querySelectorAll<SVGTextElement>(
        `${sel} text`
      )) {
        const q = quad(t);
        if (!q) {
          issues.push(`${label(t)} "${t.textContent}" is not rendered`);
          continue;
        }
        texts.push({ el: t, q });
      }
      for (let i = 0; i < texts.length; i += 1) {
        for (let j = i + 1; j < texts.length; j += 1) {
          if (quadsOverlap(texts[i].q, texts[j].q)) {
            issues.push(
              `type collides: "${texts[i].el.textContent}" (${label(
                texts[i].el
              )}) over "${texts[j].el.textContent}" (${label(texts[j].el)})`
            );
          }
        }
      }

      // 5. No pavement is drawn through the main terminal. An early draft ran
      //    taxiway N straight across the building.
      for (const pave of document.querySelectorAll<SVGGraphicsElement>(
        `${sel} .ap-taxiway, ${sel} .ap-pavement`
      )) {
        const b = rect(box(pave));
        if (
          b.x0 < main.x1 &&
          b.x1 > main.x0 &&
          b.y0 < main.y1 &&
          b.y1 > main.y0
        ) {
          issues.push(
            `pavement ${label(pave)} at ${r2(b.x0)},${r2(b.y0)}..${r2(
              b.x1
            )},${r2(b.y1)} crosses the main terminal ${main.x0},${main.y0}..${
              main.x1
            },${main.y1}`
          );
        }
      }

      // 6. Chart furniture and the off-airport row live in the margin, below
      //    the neat line. The scale bar was once drawn on top of runway 09R.
      for (const m of document.querySelectorAll<SVGGraphicsElement>(
        `${sel} .ap-furniture, ${sel} .ap-off, ${sel} > image`
      )) {
        const b = rect(box(m));
        if (b.y0 < neatBottom) {
          issues.push(
            `margin ${label(m)} reaches y=${r2(
              b.y0
            )}, above the neat line at ${neatBottom}`
          );
        }
      }

      return issues;
    },
    {
      sel: PLATE,
      concourses: CONCOURSE_BOXES,
      main: { x0: MAIN.x0, x1: MAIN.x1, y0: MAIN.y0, y1: MAIN.y1 },
      neatBottom: NEAT_BOTTOM,
    }
  );
}

test.describe('homepage airport diagram', () => {
  test('draws every structure and keeps the type set inside the one that owns it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    // Count before measuring, and before waiting on the plate to scroll into
    // view. Every measurement below walks a NodeList, and a walk over an empty
    // list passes: without these an unrendered plate reports no issues at all.
    // Counting first also means a missing plate fails saying so, rather than
    // timing out on a locator that never resolves.
    const plate = page.locator(PLATE);
    await expect(plate).toHaveCount(1);
    await expect(page.locator(`${PLATE} [data-stand]`)).toHaveCount(
      STAND_COUNT
    );
    await expect(page.locator(`${PLATE} [data-stand-box]`)).toHaveCount(
      STAND_COUNT
    );
    await expect(page.locator(`${PLATE} .ap-callsign`)).toHaveCount(
      STAND_COUNT
    );
    await expect(page.locator(`${PLATE} [data-concourse]`)).toHaveCount(
      CONCOURSES.length
    );
    await expect(page.locator(`${PLATE} .ap-conc-plate`)).toHaveCount(
      CONCOURSES.length
    );
    await expect(page.locator(`${PLATE} [data-main-terminal]`)).toHaveCount(1);
    // The N/S/E taxiways were removed on request. Asserted as absent rather
    // than dropped, so re-adding them is a deliberate act and not a drift.
    await expect(page.locator(`${PLATE} .ap-taxiway`)).toHaveCount(0);
    await expect(page.locator(`${PLATE} .ap-furniture`)).toHaveCount(1);
    // The off-airport row is the section's central argument rendered as
    // geometry — the five providers sit OUTSIDE the neat line because
    // Threadplane never talks to them. Check 6 below measures where they are
    // drawn, and a walk over an empty NodeList reports no issues, so without
    // these two counts deleting the whole row leaves both suites green.
    await expect(page.locator(`${PLATE} .ap-off`)).toHaveCount(1);
    await expect(page.locator(`${PLATE} > image`)).toHaveCount(PROVIDERS.length);

    await plate.scrollIntoViewIfNeeded();
    await expect(plate).toBeVisible();

    // Fonts must be loaded before measuring, or a fallback face lies about
    // widths — the same trap as the architecture diagram's spec.
    await page.evaluate(() => document.fonts.ready);
    const issues = await overflowReport(page);
    expect(issues, issues.join('\n')).toEqual([]);
  });

  test('keeps the whole drawing inside its viewBox', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator(PLATE)).toHaveCount(1);
    await page.locator(PLATE).scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    const drawn = await page.evaluate((sel) => {
      const svg = document.querySelector<SVGSVGElement>(sel);
      if (!svg) throw new Error(`nothing on the page matches ${sel}`);
      const b = svg.getBBox();
      return {
        left: b.x,
        top: b.y,
        right: b.x + b.width,
        bottom: b.y + b.height,
      };
    }, PLATE);
    expect(drawn.left).toBeGreaterThanOrEqual(0);
    expect(drawn.top).toBeGreaterThanOrEqual(0);
    expect(drawn.right).toBeLessThanOrEqual(VIEW.width);
    expect(drawn.bottom).toBeLessThanOrEqual(VIEW.height);
  });

  test('hands a tablet the gate list rather than a plate at 0.7 scale', async ({ page }) => {
    // `.ap-svg` is width:100%/height:auto, so the 1000-unit plate scales with
    // its container: at a 768px viewport that container is ~707px, the plate
    // renders at 0.71, and callsigns land at 6.0px with gate ids at 5.3px.
    // The other two cases here test 1440 and 390 and straddle the hole
    // entirely, which is how it survived review. The stack therefore takes
    // over at 1023px, not the usual 767px — and never as a sideways scroll,
    // which the spec rules out for this band.
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('/');
    await page.locator('#compatibility').scrollIntoViewIfNeeded();

    await expect(page.locator('.airport-figure')).toBeHidden();

    // toBeVisible() is not enough on its own: on desktop the stack is hidden
    // by clip-path at 1px square, which Playwright still calls visible. Its
    // laid-out width is what says the list is the form a tablet actually gets.
    const stack = page.locator('.airport-stack');
    await expect(stack).toBeVisible();
    const box = await stack.boundingBox();
    expect(box, 'the accessible stack is not laid out at all').not.toBeNull();
    expect(
      box?.width ?? 0,
      'the gate list is still clipped to its 1px visually-hidden box at 900px'
    ).toBeGreaterThan(200);

    await expect(stack.locator('.airport-stack-gates li')).toHaveCount(
      STAND_COUNT
    );
    const wide = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(wide, 'no horizontal page scroll on a tablet').toBe(false);
  });

  test('lists the same gates on a phone instead of scrolling the drawing sideways', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const stack = page.locator('.airport-stack');
    await page.locator('#compatibility').scrollIntoViewIfNeeded();
    await expect(stack).toBeVisible();
    await expect(page.locator('.airport-figure')).toBeHidden();
    await expect(stack.locator('.airport-stack-gates li')).toHaveCount(
      STAND_COUNT
    );
    await expect(stack.locator('.airport-stack-group')).toHaveCount(
      CONCOURSES.length
    );
    const wide = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(wide, 'no horizontal page scroll on a phone').toBe(false);
  });
});
