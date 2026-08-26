// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import {
  FEATURED_SUGGESTIONS,
  ITINERARY_SUGGESTIONS,
  MORE_SUGGESTIONS,
  suggestionsForAppMode,
} from './welcome-suggestions';

/**
 * `?featured=` lets a link open the demo on a specific curated scenario — the
 * homepage's live tabs use it so each section frames its OWN story rather than
 * the same empty demo under four headings.
 *
 * The id is a KEY into this curated list, never free text. That is deliberate:
 * a free-text param would let any link render arbitrary chosen words inside the
 * Threadplane demo UI.
 */
describe('suggestionsForAppMode with a featured id', () => {
  const all = [...FEATURED_SUGGESTIONS, ...MORE_SUGGESTIONS, ...ITINERARY_SUGGESTIONS];

  it('gives every suggestion a unique id', () => {
    const ids = all.map((s) => s.id);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('features the suggestion whose id is requested', () => {
    const target = MORE_SUGGESTIONS[0];

    const { featured, more } = suggestionsForAppMode(false, target.id);

    expect(featured.id).toBe(target.id);
    expect(more.some((s) => s.id === target.id)).toBe(false);
  });

  it('keeps every other suggestion available in the dropdown', () => {
    const target = MORE_SUGGESTIONS[0];

    const { featured, more } = suggestionsForAppMode(false, target.id);

    expect(more).toHaveLength(all.filter((s) => !ITINERARY_SUGGESTIONS.includes(s)).length - 1);
    expect([featured, ...more].map((s) => s.id).sort()).toEqual(
      [...FEATURED_SUGGESTIONS, ...MORE_SUGGESTIONS].map((s) => s.id).sort(),
    );
  });

  it('falls back to the default when the id is unknown', () => {
    // The security-relevant case: an unknown id must NOT render what the URL
    // says. It must behave exactly as if no id were supplied.
    const { featured } = suggestionsForAppMode(false, 'no-such-suggestion');

    expect(featured.id).toBe(FEATURED_SUGGESTIONS[0].id);
  });

  it('ignores an id that is not a plain string', () => {
    const { featured } = suggestionsForAppMode(false, undefined);

    expect(featured.id).toBe(FEATURED_SUGGESTIONS[0].id);
  });

  it('honours a requested id even in app mode', () => {
    const target = FEATURED_SUGGESTIONS[1];

    const { featured } = suggestionsForAppMode(true, target.id);

    expect(featured.id).toBe(target.id);
  });

  it('still leads with the itinerary starter in app mode with no id', () => {
    const { featured } = suggestionsForAppMode(true);

    expect(featured.id).toBe(ITINERARY_SUGGESTIONS[0].id);
  });
});
