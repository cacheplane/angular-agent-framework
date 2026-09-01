import { describe, expect, it } from 'vitest';
import { LIBRARY_HREF } from '../app/solutions/[slug]/page';
import { SOLUTIONS } from './solutions-data';

/**
 * Every architecture layer names a library, and the solutions page turns that
 * name into an href through a plain `Record<string, string>`. A miss is silent
 * — the card just renders without a link — and the types cannot catch a rename
 * on one side only.
 */
describe('solutions architecture layers', () => {
  it('every named library resolves to a href', () => {
    const unresolved = SOLUTIONS
      .flatMap((s) => s.architectureLayers.map((l) => l.library))
      .filter((library) => !LIBRARY_HREF[library]);

    expect(unresolved).toEqual([]);
  });

  it('names the render library the way the docs do', () => {
    const names = new Set(
      SOLUTIONS.flatMap((s) => s.architectureLayers.map((l) => l.library)),
    );

    expect(names.has('json-render')).toBe(true);
    expect(names.has('Render')).toBe(false);
  });
});
