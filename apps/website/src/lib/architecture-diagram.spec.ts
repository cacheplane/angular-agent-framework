import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ARROWS,
  CARDS,
  CARD_GAP,
  CARD_PAD,
  COLUMNS,
  GRID,
  LOGOS,
  MODEL_STRIP,
  STRIP_GAP,
  VIEW,
  diagramHrefs,
  stripChipWidth,
} from './architecture-diagram';

const WEBSITE = resolve(__dirname, '../..');
const onGrid = (n: number) => n % GRID === 0;
const card = (id: string) => CARDS.find((c) => c.id === id)!;

describe('architecture diagram geometry', () => {
  it('puts every card on the 8px grid, inside the view with a 40px margin', () => {
    for (const c of CARDS) {
      for (const [k, v] of Object.entries({
        x: c.x,
        y: c.y,
        width: c.width,
        height: c.height,
      })) {
        expect(onGrid(v), `${c.id}.${k} = ${v}`).toBe(true);
      }
      expect(c.x, `${c.id} left`).toBeGreaterThanOrEqual(40);
      expect(c.x + c.width, `${c.id} right`).toBeLessThanOrEqual(
        VIEW.width - 40
      );
      expect(c.y, `${c.id} top`).toBeGreaterThanOrEqual(40);
      expect(c.y + c.height, `${c.id} bottom`).toBeLessThanOrEqual(
        VIEW.height - 40
      );
    }
    expect(onGrid(VIEW.width) && onGrid(VIEW.height)).toBe(true);
  });

  it('never overlaps two cards, and separates vertical neighbours by at least the card gap', () => {
    const overlap = (a: (typeof CARDS)[number], b: (typeof CARDS)[number]) =>
      a.x < b.x + b.width &&
      b.x < a.x + a.width &&
      a.y < b.y + b.height &&
      b.y < a.y + a.height;
    for (const a of CARDS)
      for (const b of CARDS)
        if (a !== b) expect(overlap(a, b), `${a.id} vs ${b.id}`).toBe(false);
    for (const a of CARDS) {
      const below = CARDS.filter((b) => b.x === a.x && b.y > a.y).sort(
        (p, q) => p.y - q.y
      )[0];
      if (below)
        expect(below.y - (a.y + a.height), `${a.id} ↓ ${below.id}`).toBe(
          CARD_GAP
        );
    }
  });

  it('levels the columns: users and Threadplane span the adapter stack exactly', () => {
    const top = card('langgraph-sdk');
    const bottom = card('ag-ui');
    for (const id of ['users', 'threadplane']) {
      expect(card(id).y).toBe(top.y);
      expect(card(id).y + card(id).height).toBe(bottom.y + bottom.height);
    }
    expect(card('langsmith').y).toBe(top.y);
    expect(card('ag-ui-servers').y).toBe(bottom.y);
  });

  it('draws every arrow from one card edge to the next card edge, on a grid row', () => {
    for (const a of ARROWS) {
      expect(onGrid(a.y), `arrow y ${a.y}`).toBe(true);
      const from = CARDS.find(
        (c) => c.x + c.width === a.x1 && a.y > c.y && a.y < c.y + c.height
      );
      const to = CARDS.find(
        (c) => c.x === a.x2 && a.y > c.y && a.y < c.y + c.height
      );
      expect(from, `arrow at ${a.x1} leaves a card`).toBeDefined();
      expect(to, `arrow at ${a.x2} enters a card`).toBeDefined();
      expect(a.y).toBeGreaterThan(from!.y);
      expect(a.y).toBeLessThan(from!.y + from!.height);
    }
  });

  it("keeps the column labels at their column's left edge", () => {
    for (const col of COLUMNS) {
      expect(
        CARDS.some((c) => c.x === col.x),
        col.label
      ).toBe(true);
    }
  });

  it('fits the model strip inside the view', () => {
    let x: number = MODEL_STRIP.x;
    for (const chip of MODEL_STRIP.chips)
      x += stripChipWidth(chip.label) + STRIP_GAP;
    // The caption follows the last chip; leave it room.
    expect(x + 8 + MODEL_STRIP.caption.length * 7).toBeLessThanOrEqual(
      VIEW.width - 40
    );
    expect(MODEL_STRIP.chipY + 36).toBeLessThanOrEqual(VIEW.height - 24);
  });

  it('keeps every text row inside its card vertically', () => {
    for (const c of CARDS) {
      for (const r of c.rows) {
        if (r.kind === 'text' || r.kind === 'mono') {
          expect(r.y, `${c.id} row ${r.text}`).toBeGreaterThan(c.y + 40);
          expect(r.y, `${c.id} row ${r.text}`).toBeLessThanOrEqual(
            c.y + c.height - 12
          );
        }
        if (r.kind === 'caps') {
          expect(r.y + r.caps.length * 40).toBeLessThanOrEqual(
            c.y + c.height - 24
          );
        }
        if (r.kind === 'marks') {
          expect(
            c.x + CARD_PAD + (r.marks.length - 1) * r.step + r.size
          ).toBeLessThanOrEqual(c.x + c.width - CARD_PAD);
        }
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
    expect(diagramHrefs().length).toBeGreaterThanOrEqual(9);
  });

  it('uses only marks that exist under /logos', () => {
    for (const [key, path] of Object.entries(LOGOS)) {
      expect(existsSync(resolve(WEBSITE, `public${path}`)), key).toBe(true);
    }
    for (const c of CARDS) {
      if (c.mark) expect(LOGOS[c.mark]).toBeDefined();
      for (const r of c.rows) {
        if (r.kind === 'badge') expect(LOGOS[r.mark]).toBeDefined();
        if (r.kind === 'marks')
          for (const m of r.marks) expect(LOGOS[m]).toBeDefined();
      }
    }
    for (const chip of MODEL_STRIP.chips)
      expect(LOGOS[chip.mark]).toBeDefined();
  });
});
