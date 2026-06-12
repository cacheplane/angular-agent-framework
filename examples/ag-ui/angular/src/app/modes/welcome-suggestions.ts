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
}

export const FEATURED_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  { label: 'Docs & citations', value: 'What do the docs say about streaming?' },
  { label: 'Generative UI', value: 'Build me a revenue dashboard' },
  { label: 'Human approval', value: 'Issue me a $50 refund' },
];

export const MORE_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  { label: 'Read my itinerary', value: "What's on my itinerary?" },
  { label: 'Agent edits the page', value: 'Add the Louvre to day 2 of my trip' },
  { label: 'Consent-gated clear', value: 'Clear my day 2 plans' },
  { label: 'Research subagent', value: 'Research AG-UI and give me the highlights' },
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
