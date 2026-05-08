// SPDX-License-Identifier: MIT

/**
 * Welcome suggestion prompts shown in each mode's empty state. Kept in
 * one file so all three modes ship the same list — and so adding a
 * suggestion (e.g. one that exercises tables, code blocks, etc.) is a
 * single-file change.
 */
export interface WelcomeSuggestion {
  readonly label: string;
  readonly value: string;
}

export const WELCOME_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  { label: 'Tell me about coral reefs', value: 'Tell me about coral reefs' },
  { label: 'Write a haiku about Angular', value: 'Write a haiku about Angular' },
  { label: 'List 5 productivity tips', value: 'List 5 productivity tips, in markdown bullets.' },
  {
    label: 'Compare Angular signals, RxJS, and zone.js',
    value:
      'Show me a table comparing Angular signals, RxJS, and zone.js — three columns: name, mental model, when to use.',
  },
  {
    label: 'Explain promises with code',
    value: 'Explain JavaScript promises with a fenced code block in TypeScript.',
  },
];
