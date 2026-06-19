// SPDX-License-Identifier: MIT

/**
 * Welcome suggestion prompts shown in each mode's empty state. Kept in
 * one file so all three modes ship the same list — and so adding a
 * suggestion (e.g. one that exercises tables, code blocks, etc.) is a
 * single-file change.
 *
 * Two-tier surface:
 *   - FEATURED_SUGGESTIONS — 3 curated prompts shown as chips above the
 *     fold. Each picks a distinct capability path so a first-time
 *     visitor sees breadth in one glance: markdown streaming, tool use
 *     with citations, and a GenUI surface render.
 *   - MORE_SUGGESTIONS — the remaining 14 prompts, surfaced behind a
 *     "More prompts" dropdown rendered by WelcomeSuggestionsComponent.
 *
 * The flat WELCOME_SUGGESTIONS export remains for any consumer that
 * imports it (none in-tree today; preserved for back-compat).
 */
export interface WelcomeSuggestion {
  readonly label: string;
  readonly value: string;
  readonly description: string;
}

export const FEATURED_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  // 1. GenUI surface render — the canonical demo's most differentiating capability
  {
    label: 'Generative UI: contact form',
    value:
      'Show me a contact form with fields for name, email address, subject, and a multi-line message, plus a Send button.',
    description: 'Streams a form the model builds; you can fill it in and submit.',
  },

  // 2. Markdown / streaming showcase
  {
    label: 'Tell me about coral reefs',
    value: 'Tell me about coral reefs',
    description: 'Streams a rich markdown response — headings, bullets, and emphasis.',
  },

  // 3. Tool use + citations
  {
    label: 'Angular signals — search and cite',
    value:
      'Use the search tool to find authoritative information about Angular signals, then explain what they are and when to use them. Cite each source inline as [^doc-id] using the document `id` field returned by the tool.',
    description: 'Calls a search tool and weaves inline citations into the reply.',
  },
];

export const MORE_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  {
    label: 'Write a haiku about Angular',
    value: 'Write a haiku about Angular',
    description: 'Quick streaming output — good for checking latency.',
  },
  {
    label: 'List 5 productivity tips',
    value: 'List 5 productivity tips, in markdown bullets.',
    description: 'Renders a markdown bullet list in the streaming bubble.',
  },
  {
    label: 'Compare signals, RxJS, and zone.js',
    value:
      'Show me a table comparing Angular signals, RxJS, and zone.js — three columns: name, mental model, when to use.',
    description: 'Renders a markdown comparison table across three columns.',
  },
  {
    label: 'Explain promises with code',
    value: 'Explain JavaScript promises with a fenced code block in TypeScript.',
    description: 'Shows the syntax-highlighted code block renderer.',
  },
  {
    label: 'Solve a multi-step puzzle',
    value:
      'Three friends start with 14 apples. They share them so each gets a different prime number of apples and one gets exactly twice as many as another. How many does each get? Walk through your reasoning step by step.',
    description: 'Try Effort = high — shows step-by-step chain-of-thought output.',
  },
  {
    label: 'Approve before a destructive action',
    value:
      'I want to clean up old database backups older than 90 days. Walk me through what you would delete, and call request_approval before doing anything destructive so I can review your plan.',
    description: 'Pauses mid-run for your approval before proceeding.',
  },
  {
    label: 'Dispatch a research subagent',
    value:
      'Use the research subagent to investigate the history and motivation behind Angular standalone components, then report back with a concise summary.',
    description: 'Parent delegates work to a subagent and streams back the result.',
  },
  {
    label: 'Generative UI: feedback form',
    value:
      'Build me an interactive feedback form with a name field, a 1–5 rating picker, and a Submit button.',
    description: 'Renders an interactive form with a rating input and Submit button.',
  },
  {
    label: 'Generative UI: settings card',
    value:
      'Render a settings card with a toggle for dark mode, a language dropdown (English / Spanish / French), and a Save button.',
    description: 'Composes toggle, dropdown, and button components into a card.',
  },
  {
    label: 'Generative UI: poll',
    value:
      'Create a quick poll asking "Which front-end framework do you prefer?" with options Angular, React, Vue, and Svelte, plus a Vote button.',
    description: 'Renders a live-vote poll component you can interact with.',
  },
  {
    label: 'Generative UI: media product card',
    value:
      'Render a product card with: a header image at the top, a tab strip with two tabs ("Overview" and "Specs"). Under Overview show a Row containing an icon and a short description Text. Under Specs show a List of feature bullets each prefixed with a small icon. Below the tabs add a primary "Add to cart" Button.',
    description: 'Combines image, tabs, icons, and list into a rich product card.',
  },
  {
    label: 'Generative UI: booking surface with modal',
    value:
      'Render a booking surface: a heading "Book your trip", a DateTimeInput for travel date, a horizontal divider, then a Row containing two Cards (one for departure city, one for return city) each with a TextField. Below the Row add a primary "Continue" Button whose action opens a Modal containing a confirmation Column with a summary Text and Confirm / Cancel Buttons.',
    description: 'Multi-component layout ending in a confirmation modal.',
  },
  {
    label: 'Smoke: media + layout kitchen sink',
    value:
      'Render a Card containing a Tabs component with two tabs labeled "Media" and "Layout". Under the Media tab show a Column containing: a header Image (use https://placehold.co/600x300/4f8df5/ffffff.png as the URL), an Icon (any icon name from the canonical set, e.g. star), a short Text caption, an AudioPlayer (use https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3 as the URL), and a Video (use https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4 as the URL). Under the Layout tab show: a Row containing two Text components separated by a vertical Divider, then a horizontal Divider, then a List of three Text bullet items, then a Column containing two Text components.',
    description: 'Exercises image, audio, video, divider, row, and list primitives.',
  },
  {
    label: 'Smoke: interactive form kitchen sink',
    value:
      'Render a Card titled "Profile setup" containing a Column with: a TextField for display name, a Slider for "experience years" (range 0-30), a CheckBox for "subscribe to newsletter", a DateTimeInput for birthday (date only), a MultipleChoice for "favorite frameworks" with options Angular, React, Vue, Svelte and maxAllowedSelections of 3 (multi-select), a horizontal Divider, a Row containing a primary "Save" Button and a secondary "Open details" Button whose action opens a Modal with a Column containing a Text summary and a Close Button.',
    description: 'Exercises every interactive input type plus a modal flow.',
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
