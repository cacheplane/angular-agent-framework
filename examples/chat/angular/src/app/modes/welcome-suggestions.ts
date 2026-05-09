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
  {
    label: 'Solve a multi-step puzzle (try Effort = high)',
    value:
      'Three friends start with 14 apples. They share them so each gets a different prime number of apples and one gets exactly twice as many as another. How many does each get? Walk through your reasoning step by step.',
  },
  {
    label: 'What are Angular signals? (search + cite sources)',
    value:
      'Use the search tool to find authoritative information about Angular signals, then explain what they are and when to use them. Cite each source inline as [^doc-id] using the document `id` field returned by the tool.',
  },
  {
    label: 'Demo: ask for approval before a sensitive action',
    value:
      'I want to clean up old database backups older than 90 days. Walk me through what you would delete, and call request_approval before doing anything destructive so I can review your plan.',
  },
  {
    label: 'Demo: dispatch a research subagent',
    value:
      'Use the research subagent to investigate the history and motivation behind Angular standalone components, then report back with a concise summary.',
  },
];
