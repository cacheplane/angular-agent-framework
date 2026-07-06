// SPDX-License-Identifier: MIT

/**
 * Welcome suggestion prompts shown in each mode's empty state. Kept in
 * one file so all three modes ship the same list.
 *
 * The chips span THIS demo's full capability surface over the AG-UI
 * transport — docs/citations, generative UI, human approval, the
 * frontend-owned itinerary client tools, and the research subagent
 * (list introduced in #655; presented here via the canonical two-tier
 * featured + "More prompts" UI).
 *
 * Each prompt is tagged `kind` so the surface can lead with the prompts
 * that match the current context: in App mode (the map cockpit is on
 * screen) the itinerary prompts are featured + ordered first; in plain
 * chat the broad capability prompts lead. See `suggestionsForAppMode`.
 */
export interface WelcomeSuggestion {
  readonly label: string;
  readonly value: string;
  readonly description: string;
  /** `itinerary` prompts drive the map cockpit; `capability` prompts show
   *  the transport's general features. Used to order by App mode. */
  readonly kind: 'capability' | 'itinerary';
}

/** Broad transport-capability prompts (relevant in any mode). */
const CAPABILITY_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  {
    kind: 'capability',
    label: 'Search docs and cite sources',
    value: 'What do the docs say about streaming?',
    description: 'Calls a search tool and weaves inline citations into the reply.',
  },
  {
    kind: 'capability',
    label: 'Generative UI: revenue dashboard',
    value: 'Build me a revenue dashboard',
    description: 'Streams a composed UI surface the model builds on the fly.',
  },
  {
    kind: 'capability',
    label: 'Approve before a refund',
    value: 'Issue me a $50 refund',
    description: 'Pauses mid-run and asks for your explicit approval before proceeding.',
  },
  {
    kind: 'capability',
    label: 'Delegate to a research subagent',
    value: 'Research AG-UI and give me the highlights',
    description: 'Parent spawns a subagent and streams its summary back to you.',
  },
];

/** Prompts that drive the itinerary panel / map cockpit (App mode). */
const ITINERARY_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  {
    kind: 'itinerary',
    label: 'Read my itinerary',
    value: "What's on my itinerary?",
    description: 'Agent calls a browser-side tool to read your trip data.',
  },
  {
    kind: 'itinerary',
    label: 'Agent adds a stop to day 2',
    value: 'Add the Louvre to day 2 of my trip',
    description: 'Agent mutates the itinerary panel directly via a client tool.',
  },
  {
    kind: 'itinerary',
    label: 'Clear a day (asks first)',
    value: 'Clear my day 2 plans',
    description: 'Client tool requires your confirmation before clearing the day.',
  },
];

/**
 * Pick the featured prompt + "More prompts" order for the current context.
 *
 * - App mode ON (map cockpit visible): feature "What's on my itinerary?" and
 *   list the itinerary prompts first — they match what the user is looking at.
 * - App mode OFF (plain chat): feature "Search docs…" and lead with the broad
 *   capability prompts; itinerary prompts trail (they still work, just less
 *   prominent without the map).
 */
export function suggestionsForAppMode(appModeOn: boolean): {
  readonly featured: WelcomeSuggestion;
  readonly more: readonly WelcomeSuggestion[];
} {
  if (appModeOn) {
    const [featured, ...restItinerary] = ITINERARY_SUGGESTIONS;
    return { featured, more: [...restItinerary, ...CAPABILITY_SUGGESTIONS] };
  }
  const [featured, ...restCapability] = CAPABILITY_SUGGESTIONS;
  return { featured, more: [...restCapability, ...ITINERARY_SUGGESTIONS] };
}

/**
 * Back-compat: the original two-tier split + unified array, in the plain-chat
 * order. Prefer `suggestionsForAppMode` for context-aware ordering.
 */
export const FEATURED_SUGGESTIONS: readonly WelcomeSuggestion[] = CAPABILITY_SUGGESTIONS.slice(0, 3);
export const MORE_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  ...ITINERARY_SUGGESTIONS,
  ...CAPABILITY_SUGGESTIONS.slice(3),
];
export const WELCOME_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  ...CAPABILITY_SUGGESTIONS,
  ...ITINERARY_SUGGESTIONS,
];
