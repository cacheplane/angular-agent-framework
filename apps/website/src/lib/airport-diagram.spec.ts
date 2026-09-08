import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APRON_A,
  APRON_B,
  CONC_A,
  CONC_B,
  FIELD,
  GATES_A,
  GATES_B,
  MAIN,
  NEAT,
  PROVIDERS,
  ROW1,
  ROW2,
  STAND,
  rotate,
} from './airport-diagram';

const WEBSITE = resolve(__dirname, '../..');

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
      expect(p.y, `corner ${x},${y} bottom`).toBeLessThan(NEAT.y + NEAT.height);
    }
  });

  it('parks every stand inside its apron', () => {
    const r = STAND / 2;
    const rows = [
      { xs: GATES_A.map((g) => g.x), cy: ROW1.box, apron: APRON_A },
      { xs: GATES_B.map((g) => g.x), cy: ROW2.box, apron: APRON_B },
    ];
    for (const { xs, cy, apron } of rows) {
      for (const x of xs) {
        expect(x - r, `stand at ${x} left`).toBeGreaterThanOrEqual(apron.x0);
        expect(x + r, `stand at ${x} right`).toBeLessThanOrEqual(apron.x1);
        expect(cy - r, `stand at ${x} top`).toBeGreaterThanOrEqual(apron.y0);
        expect(cy + r, `stand at ${x} bottom`).toBeLessThanOrEqual(apron.y1);
      }
    }
  });

  it('lands every gate stub on the concourse it belongs to', () => {
    // Row 1 hangs above concourse A, row 2 below concourse B. If either stub
    // stops short the gates float, which reads as a drawing error.
    expect(ROW1.stubBot).toBe(CONC_A.y0);
    expect(ROW2.stubTop).toBe(CONC_B.y1);
    expect(ROW1.stubTop).toBeLessThan(ROW1.stubBot);
    expect(ROW2.stubTop).toBeLessThan(ROW2.stubBot);
  });

  it('keeps every gate within the span of its concourse', () => {
    for (const g of GATES_A) {
      expect(g.x, `${g.gate} x`).toBeGreaterThan(CONC_A.x0);
      expect(g.x, `${g.gate} x`).toBeLessThan(CONC_A.x1);
    }
    for (const g of GATES_B) {
      expect(g.x, `${g.gate} x`).toBeGreaterThan(CONC_B.x0);
      expect(g.x, `${g.gate} x`).toBeLessThan(CONC_B.x1);
    }
  });

  it('gives both concourses gates, so neither adapter can silently empty out', () => {
    // The two-adapter story IS the diagram. A concourse with no gates would
    // still render as a building and the section would quietly stop arguing.
    expect(GATES_A.length).toBeGreaterThan(0);
    expect(GATES_B.length).toBeGreaterThan(0);
  });

  it('sizes each mark individually, and only the AWS wordmark by width', () => {
    // One shared height reads wrong: Mastra is wide and heavy, Anthropic is a
    // narrow wedge. `w` is the escape hatch for the one 1.67:1 wordmark.
    const all = [...GATES_A, ...GATES_B];
    for (const g of all) expect(g.s, `${g.gate} size`).toBeGreaterThan(0);
    expect(all.filter((g) => g.w !== undefined).map((g) => g.gate)).toEqual(['B6']);
  });

  it('points every mark at a file that exists', () => {
    for (const src of [...GATES_A, ...GATES_B].map((g) => g.src).concat(PROVIDERS.map((p) => p.src))) {
      expect(existsSync(resolve(WEBSITE, 'public', src.slice(1))), src).toBe(true);
    }
  });

  it('places the main terminal west of both concourses', () => {
    expect(MAIN.x1).toBeLessThanOrEqual(CONC_A.x0);
    expect(MAIN.x1).toBeLessThanOrEqual(CONC_B.x0);
  });
});
