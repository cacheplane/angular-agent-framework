import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ARROWS,
  CARDS,
  CARD_GAP,
  GRID,
  LOGOS,
  VIEW,
  ZONES,
  ZONE_HEAD,
  ZONE_INSET,
  chipWidth,
  diagramHrefs,
  CHIP_GAP,
  CARD_PAD,
} from './architecture-diagram';

const WEBSITE = resolve(__dirname, '../..');
const onGrid = (n: number) => n % GRID === 0;

describe('architecture diagram geometry', () => {
  it('puts every zone and card on the 8px grid', () => {
    for (const z of ZONES) {
      expect(onGrid(z.y), `${z.id}.y`).toBe(true);
      expect(onGrid(z.height), `${z.id}.height`).toBe(true);
    }
    for (const c of CARDS) {
      for (const [k, v] of Object.entries({
        x: c.x,
        y: c.y,
        width: c.width,
        height: c.height,
      })) {
        expect(onGrid(v), `${c.id}.${k} = ${v}`).toBe(true);
      }
    }
    expect(onGrid(VIEW.width) && onGrid(VIEW.height)).toBe(true);
  });

  it('lays the zones end to end with one 40px gap and a 40px margin', () => {
    expect(ZONES[0].y).toBe(40);
    ZONES.slice(1).forEach((z, i) =>
      expect(z.y).toBe(ZONES[i].y + ZONES[i].height + CARD_GAP)
    );
    const last = ZONES[ZONES.length - 1];
    expect(last.y + last.height + 40).toBe(VIEW.height);
  });

  it('keeps every card inside its zone with the zone inset, below the zone head', () => {
    for (const c of CARDS) {
      const z = ZONES.find((x) => x.id === c.zone)!;
      expect(c.x, `${c.id} left`).toBeGreaterThanOrEqual(40 + ZONE_INSET);
      expect(c.x + c.width, `${c.id} right`).toBeLessThanOrEqual(
        40 + 1200 - ZONE_INSET
      );
      expect(c.y, `${c.id} top`).toBeGreaterThanOrEqual(z.y + ZONE_HEAD);
      expect(c.y + c.height, `${c.id} bottom`).toBeLessThanOrEqual(
        z.y + z.height - 24
      );
    }
  });

  it('never overlaps two cards, and separates horizontal neighbours by exactly the card gap', () => {
    const overlap = (a: (typeof CARDS)[number], b: (typeof CARDS)[number]) =>
      a.x < b.x + b.width &&
      b.x < a.x + a.width &&
      a.y < b.y + b.height &&
      b.y < a.y + a.height;
    for (const a of CARDS)
      for (const b of CARDS)
        if (a !== b) expect(overlap(a, b), `${a.id} vs ${b.id}`).toBe(false);
    for (const a of CARDS) {
      const right = CARDS.filter((b) => b.y === a.y && b.x > a.x).sort(
        (p, q) => p.x - q.x
      )[0];
      if (right)
        expect(right.x - (a.x + a.width), `${a.id} → ${right.id}`).toBe(
          CARD_GAP
        );
    }
  });

  it('draws each arrow in the gap between two zones, at a grid x', () => {
    for (const a of ARROWS) {
      expect(onGrid(a.x)).toBe(true);
      const from = ZONES.find(
        (z) => z.y + z.height <= a.y1 + 40 && z.y < a.y1
      )!;
      const to = ZONES.find((z) => z.y === a.y2)!;
      expect(from, `arrow at ${a.y1} leaves a zone`).toBeDefined();
      expect(to, `arrow at ${a.y2} enters a zone`).toBeDefined();
    }
  });

  it('keeps every chip row inside its card', () => {
    for (const c of CARDS) {
      for (const r of c.rows) {
        if (r.kind !== 'chips') continue;
        let x = c.x + CARD_PAD;
        for (const chip of r.chips)
          x += chipWidth(chip.label, !!chip.mark) + CHIP_GAP;
        expect(x - CHIP_GAP, `${c.id} chip row at ${r.y}`).toBeLessThanOrEqual(
          c.x + c.width - CARD_PAD
        );
        expect(r.y + 28, `${c.id} chip row bottom`).toBeLessThanOrEqual(
          c.y + c.height - 16
        );
      }
    }
  });
});

describe('architecture diagram links and marks', () => {
  it('links every card and capability to a docs page that exists', () => {
    for (const href of diagramHrefs()) {
      const mdx = resolve(
        WEBSITE,
        `content/docs${href.replace(/^\/docs/, '')}.mdx`
      );
      const page = resolve(WEBSITE, `src/app${href}/page.tsx`);
      expect(existsSync(mdx) || existsSync(page), `${href}`).toBe(true);
    }
    expect(diagramHrefs().length).toBeGreaterThanOrEqual(10);
  });

  it('uses only marks that exist under /logos', () => {
    for (const [key, path] of Object.entries(LOGOS)) {
      expect(existsSync(resolve(WEBSITE, `public${path}`)), key).toBe(true);
    }
    for (const c of CARDS) {
      for (const r of c.rows) {
        if (r.kind === 'chips')
          for (const chip of r.chips)
            if (chip.mark) expect(LOGOS[chip.mark]).toBeDefined();
        if (r.kind === 'marks')
          for (const m of r.marks) expect(LOGOS[m]).toBeDefined();
      }
    }
  });
});
