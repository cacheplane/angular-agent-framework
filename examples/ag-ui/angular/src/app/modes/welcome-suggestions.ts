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
 */
export interface WelcomeSuggestion {
  readonly label: string;
  readonly value: string;
  readonly description: string;
}

export const FEATURED_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  {
    label: 'Search docs and cite sources',
    value: 'What do the docs say about streaming?',
    description: 'Calls a search tool and weaves inline citations into the reply.',
  },
  {
    label: 'Generative UI: revenue dashboard',
    value: 'Build me a revenue dashboard',
    description: 'Streams a composed UI surface the model builds on the fly.',
  },
  {
    label: 'Approve before a refund',
    value: 'Issue me a $50 refund',
    description: 'Pauses mid-run and asks for your explicit approval before proceeding.',
  },
];

export const MORE_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  {
    label: 'Read my itinerary',
    value: "What's on my itinerary?",
    description: 'Agent calls a browser-side tool to read your trip data.',
  },
  {
    label: 'Agent adds a stop to day 2',
    value: 'Add the Louvre to day 2 of my trip',
    description: 'Agent mutates the itinerary panel directly via a client tool.',
  },
  {
    label: 'Clear a day (asks first)',
    value: 'Clear my day 2 plans',
    description: 'Client tool requires your confirmation before clearing the day.',
  },
  {
    label: 'Delegate to a research subagent',
    value: 'Research AG-UI and give me the highlights',
    description: 'Parent spawns a subagent and streams its summary back to you.',
  },
];

/**
 * Back-compat: unified array combining featured + more in the original
 * order. Kept so existing imports don't break. Prefer FEATURED_SUGGESTIONS
 * + MORE_SUGGESTIONS for the two-tier UI.
 */
export const WELCOME_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  ...FEATURED_SUGGESTIONS,
  ...MORE_SUGGESTIONS,
];
