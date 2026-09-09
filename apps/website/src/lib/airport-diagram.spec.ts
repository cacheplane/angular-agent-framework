import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONCOURSES,
  FIELD,
  GATES_A,
  GATES_B,
  MAIN,
  NEAT,
  NORTH,
  PLANE_PATH,
  PROVIDERS,
  PROVIDER_ROW,
  ROT,
  RWY_N,
  RWY_S,
  SCALE_BAR,
  STAND,
  VIEW,
  WIDE_RATIO,
  rotate,
} from './airport-diagram';

const WEBSITE = resolve(__dirname, '../..');

/**
 * Each stand counter-rotates by -ROT about its own centre, so the square it
 * sweeps in field coordinates is wider than the square itself: STAND / 2 is
 * the half-side, this is the half-extent. Using STAND / 2 lets a stand poke
 * ~1.1 units past an apron edge with the suite green.
 */
const RAD = (ROT * Math.PI) / 180;
const STAND_HALF = (STAND / 2) * (Math.abs(Math.cos(RAD)) + Math.abs(Math.sin(RAD)));

const NEAT_BOTTOM = NEAT.y + NEAT.height;

/**
 * Every mark the plate draws, from both tables: the gates on the field and the
 * providers in the margin. A gate states its own height, a provider takes the
 * row's — but both may carry `w`, so the two sizing tests below have to walk
 * them together or the margin row's only wordmark goes unchecked.
 */
const MARKS: readonly { label: string; src: string; s: number; w?: number }[] = [
  ...[...GATES_A, ...GATES_B].map((g) => ({ label: g.gate, src: g.src, s: g.s, w: g.w })),
  ...PROVIDERS.map((p) => ({ label: p.name, src: p.src, s: PROVIDER_ROW.size, w: p.w })),
];

describe('airport diagram geometry', () => {
  it('keeps all four rotated field corners inside the neat line', () => {
    const corners = [
      [FIELD.x0, FIELD.y0],
      [FIELD.x1, FIELD.y0],
      [FIELD.x0, FIELD.y1],
      [FIELD.x1, FIELD.y1],
    ] as const;
    for (const [x, y] of corners) {
      const p = rotate(x, y);
      expect(p.x, `corner ${x},${y} left`).toBeGreaterThan(NEAT.x);
      expect(p.x, `corner ${x},${y} right`).toBeLessThan(NEAT.x + NEAT.width);
      expect(p.y, `corner ${x},${y} top`).toBeGreaterThan(NEAT.y);
      expect(p.y, `corner ${x},${y} bottom`).toBeLessThan(NEAT_BOTTOM);
    }
  });

  it('holds every drawn structure inside the field that claims to bound them', () => {
    // FIELD is only worth testing corners for if it actually bounds the
    // drawing. Without this, a concourse or an apron can run off the plate —
    // past the viewBox, even — while the corner test above stays green,
    // because nothing else compares a structure against FIELD at all.
    // Comparisons are inclusive: the runways ARE the field's top and bottom
    // edges and the main terminal ITS west edge, by design.
    const inside = (label: string, x0: number, x1: number, y0: number, y1: number) => {
      expect(x0, `${label} left`).toBeGreaterThanOrEqual(FIELD.x0);
      expect(x1, `${label} right`).toBeLessThanOrEqual(FIELD.x1);
      expect(y0, `${label} top`).toBeGreaterThanOrEqual(FIELD.y0);
      expect(y1, `${label} bottom`).toBeLessThanOrEqual(FIELD.y1);
    };

    // Read off CONCOURSES rather than listed by hand: a third concourse is
    // bounded the moment it is declared, instead of the day someone remembers
    // to add its box and its apron to a list over here.
    const boxes = [
      ['MAIN', MAIN] as const,
      ...CONCOURSES.flatMap(
        (c) => [[`CONC_${c.id}`, c.box], [`APRON_${c.id}`, c.apron]] as const
      ),
    ];
    for (const [label, b] of boxes) inside(label, b.x0, b.x1, b.y0, b.y1);

    for (const [label, r] of [
      ['RWY_N', RWY_N],
      ['RWY_S', RWY_S],
    ] as const) {
      inside(label, FIELD.x0, FIELD.x1, r.y, r.y + r.h);
    }

    for (const c of CONCOURSES) {
      for (const g of c.gates) {
        inside(
          `stand ${g.gate}`,
          g.x - STAND_HALF,
          g.x + STAND_HALF,
          c.row.standCy - STAND_HALF,
          c.row.standCy + STAND_HALF
        );
      }
    }
  });

  it('parks every stand inside its apron', () => {
    for (const { gates, row, apron, id } of CONCOURSES) {
      for (const g of gates) {
        expect(g.x - STAND_HALF, `${g.gate} left of apron ${id}`).toBeGreaterThanOrEqual(apron.x0);
        expect(g.x + STAND_HALF, `${g.gate} right of apron ${id}`).toBeLessThanOrEqual(apron.x1);
        expect(row.standCy - STAND_HALF, `${g.gate} top of apron ${id}`).toBeGreaterThanOrEqual(
          apron.y0
        );
        expect(row.standCy + STAND_HALF, `${g.gate} bottom of apron ${id}`).toBeLessThanOrEqual(
          apron.y1
        );
      }
    }
  });

  it('stacks each row so the box, the callsign and the stub never collide', () => {
    // Every value in a row is a y, and only their order makes the row legible:
    // the callsign hangs below the stand box, and the stub runs from the
    // concourse to the far side of the pair. Slide the box down onto its own
    // label and every other geometry test here still passes.
    for (const { row, gatesAbove, id } of CONCOURSES) {
      const top = row.standCy - STAND_HALF;
      const bottom = row.standCy + STAND_HALF;
      expect(row.labelY, `${id} callsign clears the stand box`).toBeGreaterThan(bottom);
      expect(row.stubTop, `${id} stub`).toBeLessThan(row.stubBot);
      if (gatesAbove) {
        // Gates sit above the concourse, so the stub starts below the callsign.
        expect(row.stubTop, `${id} stub clears the callsign`).toBeGreaterThan(row.labelY);
      } else {
        // Gates sit below the concourse, so the stub ends above the stand box.
        expect(row.stubBot, `${id} stub clears the stand box`).toBeLessThan(top);
      }
    }
  });

  it('lands every gate stub on the concourse it belongs to', () => {
    // If either stub stops short the gates float, which reads as a drawing
    // error. Which side the row hangs on comes from CONCOURSES, not from the
    // ROW1/ROW2 names.
    for (const { row, box, gatesAbove, id } of CONCOURSES) {
      if (gatesAbove) expect(row.stubBot, `${id} stub meets the concourse`).toBe(box.y0);
      else expect(row.stubTop, `${id} stub meets the concourse`).toBe(box.y1);
      expect(row.stubTop, `${id} stub`).toBeLessThan(row.stubBot);
    }
  });

  it('keeps every gate within the span of its concourse', () => {
    for (const { gates, box, id } of CONCOURSES) {
      for (const g of gates) {
        expect(g.x, `${g.gate} x in concourse ${id}`).toBeGreaterThan(box.x0);
        expect(g.x, `${g.gate} x in concourse ${id}`).toBeLessThan(box.x1);
      }
    }
  });

  it('gives both concourses gates, so neither adapter can silently empty out', () => {
    // The two-adapter story IS the diagram. A concourse with no gates would
    // still render as a building and the section would quietly stop arguing.
    expect(GATES_A.length).toBeGreaterThan(0);
    expect(GATES_B.length).toBeGreaterThan(0);
    for (const c of CONCOURSES) expect(c.gates.length, `concourse ${c.id}`).toBeGreaterThan(0);
  });

  it('takes the wide ratio from the artwork, not from taste', () => {
    // WIDE_RATIO decides how wide the AWS wordmark is drawn in two places, so
    // it has to be the shape of the actual file or the mark is stretched. This
    // is the only assertion here that ties the constant to something outside
    // the module, and it is what stops the `w` vs `s * WIDE_RATIO` check below
    // from closing back on itself.
    for (const m of MARKS) {
      if (m.w === undefined) continue;
      const svg = readFileSync(resolve(WEBSITE, 'public', m.src.slice(1)), 'utf8');
      const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
      expect(viewBox, `${m.src} has no viewBox to measure`).toBeDefined();
      const [, , vbW, vbH] = (viewBox as string).trim().split(/[\s,]+/).map(Number);
      expect(vbW, `${m.src} viewBox width`).toBeGreaterThan(0);
      expect(vbH, `${m.src} viewBox height`).toBeGreaterThan(0);
      expect(
        Math.abs(WIDE_RATIO - vbW / vbH),
        `${m.label}: WIDE_RATIO ${WIDE_RATIO} vs ${m.src} ${vbW}/${vbH} = ${vbW / vbH}`
      ).toBeLessThanOrEqual(0.02);
    }
  });

  it('sizes each mark individually, and any wordmark at the wide ratio', () => {
    // One shared height reads wrong: Mastra is wide and heavy, Anthropic is a
    // narrow wedge. `w` is the escape hatch for a wordmark that is not square.
    // Both numbers are literal, so this compares two independent values against
    // a ratio the test above pins to the file itself. A second wordmark is
    // allowed to join; an off-ratio one is not.
    for (const m of MARKS) {
      expect(m.s, `${m.label} size`).toBeGreaterThan(0);
      if (m.w !== undefined) {
        expect(m.w, `${m.label} width`).toBeGreaterThan(m.s);
        expect(
          Math.abs(m.w - m.s * WIDE_RATIO),
          `${m.label} w ${m.w} vs s ${m.s} x ${WIDE_RATIO} = ${m.s * WIDE_RATIO}`
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it('points every mark at a file that exists', () => {
    for (const src of [...GATES_A, ...GATES_B].map((g) => g.src).concat(PROVIDERS.map((p) => p.src))) {
      expect(existsSync(resolve(WEBSITE, 'public', src.slice(1))), src).toBe(true);
    }
  });

  it('places the main terminal west of both concourses, and connects it to each', () => {
    // Strictly west: at equality the two connector paths would be zero-length
    // and the terminal would read as fused to the concourses.
    for (const { id, box, link } of CONCOURSES) {
      expect(MAIN.x1, `main terminal west of concourse ${id}`).toBeLessThan(box.x0);
      // A connector leaves the terminal wall and lands on the concourse wall,
      // so it has to fall inside both y spans. Move a concourse up or down
      // without moving its link and the line detaches at one end. The pairing
      // comes from CONCOURSES, so it cannot be got wrong here.
      expect(link, `link ${id} leaves the terminal`).toBeGreaterThan(MAIN.y0);
      expect(link, `link ${id} leaves the terminal`).toBeLessThan(MAIN.y1);
      expect(link, `link ${id} lands on the concourse`).toBeGreaterThan(box.y0);
      expect(link, `link ${id} lands on the concourse`).toBeLessThan(box.y1);
    }
  });

  it('keeps the margin band below the neat line and inside the view', () => {
    // Chart furniture is off-airport by construction, not by prose: the
    // provider row, the scale bar and the north arrow all live between the
    // neat line and the bottom of the viewBox. PROVIDER_ROW.y is the marks'
    // centre line, so the row's own height has to be counted at both edges.
    const markTop = PROVIDER_ROW.y - PROVIDER_ROW.size / 2;
    const markBottom = PROVIDER_ROW.y + PROVIDER_ROW.size / 2;
    expect(PROVIDER_ROW.labelY, 'off-airport label').toBeGreaterThan(NEAT_BOTTOM);
    expect(PROVIDER_ROW.labelY, 'off-airport label').toBeLessThan(markTop);
    expect(markTop, 'provider marks').toBeGreaterThan(NEAT_BOTTOM);
    expect(markBottom, 'provider marks').toBeLessThanOrEqual(VIEW.height);
    expect(SCALE_BAR.y, 'scale bar').toBeGreaterThan(NEAT_BOTTOM);
    expect(SCALE_BAR.y, 'scale bar').toBeLessThanOrEqual(VIEW.height);
    expect(SCALE_BAR.x0, 'scale bar').toBeLessThan(SCALE_BAR.x1);
    expect(SCALE_BAR.x1, 'scale bar').toBeLessThanOrEqual(VIEW.width);
    expect(NORTH.y, 'north arrow').toBeGreaterThan(NEAT_BOTTOM);
    expect(NORTH.y, 'north arrow').toBeLessThanOrEqual(VIEW.height);
    expect(NORTH.x, 'north arrow').toBeLessThanOrEqual(VIEW.width);

    // The widest mark is a wordmark, so the row's right edge is ratio-scaled.
    const rowRight =
      PROVIDER_ROW.x0 +
      (PROVIDERS.length - 1) * PROVIDER_ROW.step +
      PROVIDER_ROW.size * WIDE_RATIO;
    expect(rowRight, 'provider row fits the view').toBeLessThanOrEqual(VIEW.width);
    expect(rowRight, 'provider row clears the scale bar').toBeLessThan(SCALE_BAR.x0);
  });
});

describe('airport diagram marks', () => {
  it('draws the same plane the shared PlaneMark draws', () => {
    // PLANE_PATH is a second copy of the `d` in ui/PlaneMark.tsx, because the
    // plate needs the raw path inside a transform rather than the component.
    // PlaneMark is used across the whole site and is not this module's to
    // change, so the duplication is checked here instead of asserted in a
    // comment.
    const mark = readFileSync(resolve(WEBSITE, 'src/components/ui/PlaneMark.tsx'), 'utf8');
    expect(mark, 'PlaneMark.tsx no longer draws PLANE_PATH').toContain(PLANE_PATH);
  });
});
