// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { SOLUTIONS, getSolutionBySlug } from './solutions-data';
import { DEMO_CDN } from './demo-media';

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
      expect(solution.code.length, solution.slug).toBeGreaterThan(0);
      for (const block of solution.code) {
        expect(block.source.trim().length, `${solution.slug}/${block.label}`).toBeGreaterThan(80);
        expect(block.label.trim().length, solution.slug).toBeGreaterThan(0);
        expect(block.source, `${solution.slug}/${block.label}`).not.toMatch(/TODO|FIXME|\.\.\.$/);
      }
    }
  });

  it('shows a different part of the stack in each entry', () => {
    // Compare the FRAMEWORK surface, not every identifier. An earlier version
    // matched any `name(` and broke as soon as the snippets grew — two entries
    // both calling `filter()` says nothing about which part of the stack they
    // show. What matters is which agent methods and package entry points each
    // one reaches for.
    //
    // `injectAgent` is deliberately absent: every Angular snippet starts there.
    const FRAMEWORK_ENTRY = /\b(views|defineAngularRegistry|provideAgent|provideRender|signalStateStore)\s*\(/g;
    const AGENT_METHOD = /\bagent\.(\w+)\s*\(/g;

    const surface = (solution: (typeof SOLUTIONS)[number]) => {
      const all = solution.code.map((b) => b.source).join('\n');
      return new Set([
        ...(all.match(FRAMEWORK_ENTRY) ?? []).map((c) => c.replace(/\s*\($/, '')),
        ...[...all.matchAll(AGENT_METHOD)].map((m) => `agent.${m[1]}`),
      ]);
    };

    for (const a of SOLUTIONS) {
      for (const b of SOLUTIONS) {
        if (a.slug >= b.slug) continue;
        const [sa, sb] = [surface(a), surface(b)];
        expect(sa.size, `${a.slug} exercises no framework API`).toBeGreaterThan(0);
        const shared = [...sa].filter((call) => sb.has(call));
        expect(shared, `${a.slug} vs ${b.slug} exercise the same API`).toEqual([]);
      }
    }
  });

  it('only attaches a clip to an entry whose claim it shows', () => {
    // The HITL clip illustrates an approval gate. `analytics` has no approval
    // story, so reusing the footage there would be padding — the same asset
    // under a heading it does not illustrate.
    const withDemo = SOLUTIONS.filter((s) => s.demo).map((s) => s.slug).sort();

    expect(withDemo).toEqual(['compliance', 'customer-support']);
  });

  it('serves every clip from the shared blob base', () => {
    // A hardcoded URL here would drift the next time the store moves.
    for (const solution of SOLUTIONS) {
      if (!solution.demo) continue;
      for (const url of [solution.demo.videoMp4, solution.demo.videoWebm, solution.demo.poster]) {
        expect(url, solution.slug).toContain(DEMO_CDN);
      }
    }
  });

  it('resolves a known slug and rejects an unknown one', () => {
    expect(getSolutionBySlug('compliance')?.slug).toBe('compliance');
    expect(getSolutionBySlug('not-a-solution')).toBeUndefined();
  });
});
