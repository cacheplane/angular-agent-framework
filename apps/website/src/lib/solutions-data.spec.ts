// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { SOLUTIONS, getSolutionBySlug } from './solutions-data';

/**
 * The file header of `solutions-data.ts` sets an editorial rule: no entry may
 * be a find-and-replace of another. Most of that rule needs human judgement.
 * These tests pin the parts that do not — the mechanical tells that a new
 * entry was cloned from an existing one.
 */
describe('SOLUTIONS', () => {
  it('gives every entry a distinct slug', () => {
    const slugs = SOLUTIONS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('never repeats a proof-point marker across entries', () => {
    // Two entries sharing a marker is the specific tell that one was cloned:
    // `compliance` and `customer-support` both carried `Required` for a claim
    // that differed only in its synonyms.
    const markers = SOLUTIONS.flatMap((s) => s.proofPoints.map((p) => p.metric));
    const duplicates = markers.filter((m, i) => markers.indexOf(m) !== i);
    expect(duplicates).toEqual([]);
  });

  it('gives every entry real code, not a placeholder', () => {
    for (const solution of SOLUTIONS) {
      expect(solution.code.source.trim().length, solution.slug).toBeGreaterThan(80);
      expect(solution.code.label.trim().length, solution.slug).toBeGreaterThan(0);
      expect(solution.code.source, solution.slug).not.toMatch(/TODO|FIXME|\.\.\.$/);
    }
  });

  it('shows a different part of the stack in each entry', () => {
    // Not just "is the text different" — the snippets must not collapse to the
    // same call. Compare the identifiers each one actually exercises.
    //
    // Framework entry points appear in every Angular snippet and carry no
    // information about WHICH part of the stack is on show, so they are
    // excluded. Keep this list to genuine boilerplate: adding a meaningful API
    // here (`interrupt`, `history`, `submit`) would silence exactly the
    // duplication this test exists to catch.
    const UBIQUITOUS = new Set(['injectAgent(', 'computed(']);
    const apiSurface = (source: string) =>
      new Set(
        (source.match(/\b[a-zA-Z_][a-zA-Z0-9_]{4,}\s*\(/g) ?? []).filter(
          (call) => !UBIQUITOUS.has(call),
        ),
      );

    for (const a of SOLUTIONS) {
      for (const b of SOLUTIONS) {
        if (a.slug >= b.slug) continue;
        const [sa, sb] = [apiSurface(a.code.source), apiSurface(b.code.source)];
        const shared = [...sa].filter((call) => sb.has(call));
        expect(shared, `${a.slug} vs ${b.slug} call the same API`).toEqual([]);
      }
    }
  });

  it('resolves a known slug and rejects an unknown one', () => {
    expect(getSolutionBySlug('compliance')?.slug).toBe('compliance');
    expect(getSolutionBySlug('not-a-solution')).toBeUndefined();
  });
});
