/**
 * The homepage preflight checklist.
 *
 * Every row in OURS and AIRWORTHINESS was verified against the docs rather
 * than written from memory, and that caught three errors worth remembering:
 *
 *  - "Destructive actions — HELD FOR APPROVAL" was FALSE. `<chat>` does not
 *    render the interrupt panel; the docs say "Interrupt UI is not part of it
 *    — compose <chat-interrupt-panel> yourself." It is two YOURS rows now.
 *  - "Errors & retry" had been held back as unverified and is in fact the
 *    strongest line: zero-config retry across five classified error kinds.
 *  - Keyboard and screen reader stay OFF. Four components document a11y,
 *    there is no overview page and no audit, and reduced motion exists only
 *    in code with nothing to link. A tick would overclaim.
 *
 * Before adding a row: find the page that proves it. If there is no page, it
 * is not a tick.
 */
export interface ChecklistRow {
  /** Left side of the line. 1–3 words. */
  readonly challenge: string;
  /** Right side. An outcome you could verify, never a feature name. */
  readonly response: string;
  /** The page that proves it. `null` only in YOURS. */
  readonly href: string | null;
  /** Small trailing unit, AIRWORTHINESS only. */
  readonly unit?: string;
  /** Live badge rendered instead of `response` text. */
  readonly badgeSrc?: string;
}

export const PREFLIGHT_OURS: readonly ChecklistRow[] = [
  { challenge: 'A run fails', response: 'RETRY, BUILT IN', href: '/docs/chat/guides/error-handling' },
  { challenge: 'Tool calls', response: 'LIVE STATUS CARDS', href: '/docs/chat/components/chat-tool-call-card' },
  { challenge: 'Durable threads', response: 'SURVIVE RESTARTS', href: '/docs/langgraph/guides/persistence' },
  { challenge: 'Reader scrolls up', response: 'STREAM STAYS PUT', href: '/docs/chat/components/chat' },
  { challenge: 'Model output', response: 'SANITIZED, 26 NODES', href: '/docs/chat/guides/markdown' },
  { challenge: 'Shared link', response: 'URL IS THE TRUTH', href: '/docs/chat/guides/thread-routing' },
  { challenge: 'Your design system', response: 'CSS VARS, NO !IMPORTANT', href: '/docs/chat/guides/theming' },
  { challenge: 'Your tests', response: 'RUN WITHOUT A MODEL', href: '/docs/chat/getting-started/try-without-a-backend' },
  { challenge: 'Swapping backend', response: 'ONE IMPORT CHANGES', href: '/docs/choosing-an-adapter' },
  {
    challenge: 'Model drift',
    response: 'CHECKED WEEKLY, LIVE',
    // No doc page for this one. The workflow IS the source: it runs the
    // @drift e2e subset against the live provider every Monday and diffs
    // fresh recordings against the committed fixtures.
    href: 'https://github.com/cacheplane/angular-agent-framework/blob/main/.github/workflows/aimock-drift.yml',
  },
  { challenge: 'Debug panel', response: 'TREE-SHAKEN OUT', href: '/docs/chat/components/chat-debug' },
];

/**
 * The product's own words, not ours. Every response here is a paraphrase of a
 * sentence in the docs — "Never generate a thread ID client-side", "never
 * expose a LangSmith API key in client-side code", "you must configure CORS".
 *
 * These boxes never fill. That is the argument.
 */
export const PREFLIGHT_YOURS: readonly ChecklistRow[] = [
  { challenge: 'Agent endpoint', response: 'BEHIND YOUR PROXY', href: null },
  { challenge: 'API keys', response: 'NEVER IN THE BUNDLE', href: null },
  { challenge: 'Thread IDs', response: 'SERVER-GENERATED', href: null },
  { challenge: 'CORS', response: 'YOURS TO CONFIGURE', href: null },
  { challenge: 'Interrupt panel', response: 'YOU COMPOSE IT', href: null },
  { challenge: 'Resume payload', response: 'YOURS TO CHOOSE', href: null },
  { challenge: 'Runs', response: 'TRACED', href: null },
  { challenge: 'Regressions', response: 'EVALUATED', href: null },
];

/**
 * Verified 2026-09-04 against live sources. The rank and score drift — re-verify
 * on touch, and never "round up".
 */
export const AIRWORTHINESS: readonly ChecklistRow[] = [
  { challenge: 'Framework rank', response: '#8', unit: 'OF 119', href: 'https://hvtracker.net/categories/agent-frameworks/' },
  { challenge: 'OpenSSF Scorecard', response: '8.2', unit: '/ 10', href: 'https://scorecard.dev/viewer/?uri=github.com/cacheplane/angular-agent-framework' },
  {
    challenge: 'Supply-chain grade',
    // Deliberately empty: the badge is the response. It sits near an A-band
    // floor of 80 and has flipped grade several times in a month, so a
    // hardcoded number would be wrong on some days.
    response: '',
    badgeSrc: 'https://hvtracker.net/badge/threadplane.svg',
    href: 'https://hvtracker.net/agents/threadplane/',
  },
  { challenge: 'Angular support', response: '20–22', unit: 'CI-TESTED', href: 'https://www.npmjs.com/package/@threadplane/langgraph' },
  { challenge: 'Release provenance', response: 'SIGNED', unit: 'OIDC · SLSA', href: 'https://www.npmjs.com/package/@threadplane/chat' },
  { challenge: 'Cloud', response: 'NONE', unit: 'SELF-HOSTED', href: '/privacy' },
  { challenge: 'Signup', response: 'NONE', unit: 'npm i', href: '/docs/chat/getting-started/installation' },
  { challenge: 'VC board', response: 'NONE', href: '/about' },
];
