// ── Homepage copy (spec 2026-09-02-homepage-rebuild-design.md §4.1) ──────────
import { WEBSITE_SUPPORTED_ANGULAR_MAJORS } from '../components/pricing/angular-support.mjs';
import type { StageBeat } from './stage-beats';

export const HERO_EYEBROW = 'Angular · LangGraph & AG-UI';
export const HERO_H1 = 'The open-source thread-plane for agents.';
/**
 * The H1 broken where it is meant to break: three lines, one thought each.
 * HERO_H1 stays the single source of truth — positioning.spec.ts asserts the
 * lines join back to it with single spaces, so the rendered heading, the
 * <title> and the social card cannot drift apart.
 */
export const HERO_H1_LINES: readonly string[] = ['The open-source', 'thread-plane', 'for agents.'];
export const HERO_SUBHEAD =
  'Chat, threads, approvals, and generative UI on Signals and DI. Your backend stays where it is.';

/**
 * The subhead, split so Hero.tsx can marker-highlight the boundary claim.
 * HERO_SUBHEAD stays the single source of truth: positioning.spec.ts asserts
 * these segments join back to it character for character, so the two cannot
 * drift. Exactly one segment is highlighted — a second one in a sentence this
 * short reads as decoration and cancels the emphasis.
 */
export interface HeroSubheadSegment {
  text: string;
  highlight?: boolean;
}
export const HERO_SUBHEAD_SEGMENTS: readonly HeroSubheadSegment[] = [
  { text: 'Chat, threads, approvals, and generative UI on Signals and DI. ' },
  { text: 'Your backend stays where it is.', highlight: true },
];

export const HERO_PRIMARY_LABEL = 'Install Threadplane';
export const HERO_SECONDARY_LABEL = 'See it running in the docs →';
export const HERO_SECONDARY_HREF = '/docs/chat/guides/generative-ui?mode=run';

/** Kept for layout.tsx default title and the OG image alt. */
export const PRIMARY_TAGLINE = 'Threadplane — The open-source thread-plane for agents';
export const HOME_TITLE = PRIMARY_TAGLINE;
export const HOME_DESCRIPTION =
  'The open-source thread-plane for agents: chat, durable threads, persistence, human approvals, and generative UI for Angular, on LangGraph and AG-UI.';
/** Longer form used by layout.tsx OG/Twitter defaults and the About page. */
export const LONG_SUBHEAD =
  'Threadplane is the open-source thread-plane for agents: signal-native chat, durable threads, persistence, human approvals, tool progress, subagents, and generative UI for Angular, on LangGraph and AG-UI — without replacing your backend or design system.';

// ── Trust line (values verified by positioning.spec.ts + angular-support-copy.spec.ts) ──
export function formatAngularRange(majors: readonly number[]): string {
  const sorted = [...majors].sort((a, b) => a - b);
  return sorted.length > 1 ? `Angular ${sorted[0]}–${sorted[sorted.length - 1]}` : `Angular ${sorted[0]}`;
}
export const HERO_TRUST_LINE = `MIT · ${formatAngularRange(WEBSITE_SUPPORTED_ANGULAR_MAJORS)} · no account, no cloud`;

// ── The final mile (live-stage spec §3, block 3) ─────────────────────────────
export const FINAL_MILE_EYEBROW = 'Where Threadplane fits';
export const FINAL_MILE_HEADING = 'Angular teams are building agents. The last mile is still messy.';
export const FINAL_MILE_ASIDE = 'What you start with, and what Threadplane adds.';

// ── Reliability receipts (spec §3, block 2). Each links a page a human can read;
// the sourced numbers stay in Reliability.tsx beside them. ───────────────────
export interface ReliabilityReceipt {
  readonly claim: string;
  readonly detail: string;
  readonly sourceLabel: string;
  readonly sourceHref: string;
}
export const RELIABILITY_RECEIPTS: readonly ReliabilityReceipt[] = [
  {
    claim: 'Signed provenance on every release',
    detail: 'npm provenance attestations from OIDC trusted publishing, and a SLSA provenance file on each GitHub release.',
    sourceLabel: 'npmjs.com · provenance',
    sourceHref: 'https://www.npmjs.com/package/@threadplane/chat',
  },
  {
    claim: 'Three runtimes exercised end to end',
    detail: 'LangGraph, Mastra and AWS Strands backends, each driven by browser tests on every merge against one Angular contract.',
    sourceLabel: 'runtime portability matrix',
    sourceHref: '/docs/choosing-an-adapter#measured-runtime-support',
  },
  {
    claim: 'No content telemetry, no cloud',
    detail: 'Operational facts about how the product runs, never prompts, messages or tool data. MIT, self-hosted, no account.',
    sourceLabel: 'privacy policy',
    sourceHref: '/privacy',
  },
];

// ── Prove it without a backend (spec §3, block 5): the Test rows the final CTA
// absorbs. ────────────────────────────────────────────────────────────────────
export const PROVE_IT_ROWS = [
  { claim: 'No key, no server, no network', api: 'provideFakeAgent()' },
  { claim: 'Script tool calls and interrupts', api: 'mockLangGraphAgent()' },
  { claim: 'Same UI code in test and production', api: 'Agent' },
] as const;

// ── The stage rail (stage-rail spec §3–5): the four-claim ledger beside the
// pinned demo. One label, one claim and one docs link per beat; the still
// alt text describes public/screenshots/stage-<beat>.webp at the beat's settle.
/** The beat map (`stage-beats.ts`) owns the beat names; the rail copy keys off it so the two cannot drift. */
export type StageBeatKey = StageBeat;
export interface StageRailBeat {
  readonly beat: StageBeatKey;
  /** Segment label in the act navigation bar. */
  readonly label: string;
  /** The one line the rail says for this beat. */
  readonly claim: string;
  /** The page that proves it. */
  readonly docs: { readonly label: string; readonly href: string };
  /** Alt text for the fallback still: what the frame shows at this beat's settle. */
  readonly stillAlt: string;
}

export const STAGE_RAIL: readonly StageRailBeat[] = [
  {
    beat: 'stream',
    label: 'Tools',
    claim: 'Tool calls and citations as signals.',
    docs: { label: 'Tool calls', href: '/docs/chat/components/chat-tool-calls' },
    stillAlt:
      'Threadplane chat beside its devtools: a streamed answer about Angular signals with a Sources row of three citations, and the devtools Timeline listing seven checkpoints',
  },
  {
    beat: 'persist',
    label: 'Persist',
    claim: 'Durable threads, no license.',
    docs: { label: 'Persistence', href: '/docs/langgraph/guides/persistence' },
    stillAlt:
      'The thread restored after a reload and forked from an earlier checkpoint: a "Make it a haiku instead." turn with its three-line haiku reply, the cleanup prompt just sent beneath it, and the devtools Timeline showing ten checkpoints across two steps',
  },
  {
    beat: 'approve',
    label: 'Approve',
    claim: 'Interrupts and approvals, built in.',
    docs: { label: 'Interrupts', href: '/docs/langgraph/guides/interrupts' },
    stillAlt:
      'The agent paused inside delete_backups: an "Agent paused — review needed" panel with Accept, Edit, Respond and Ignore above a five-row table of backups, two marked retain, and the devtools Timeline holding at ten checkpoints',
  },
  {
    beat: 'render',
    label: 'Render',
    claim: 'Generative UI on A2UI and json-render.',
    docs: { label: '@threadplane/render', href: '/render' },
    stillAlt:
      "A generated contact form — Name, Email address, Subject, Message and a Send button — rendered from the agent's A2UI output inside the chat, with the render_a2ui_surface tool call above it",
  },
];

/** Spec §3.3: the only copy shown while recorded time is pinned at the interrupt, and the page's one scroll cue. */
export const STAGE_HOLD_LINE = 'Keep scrolling to approve.';

// ── Install variants: the ONE place install commands live on the website ─────
export type InstallVariant = 'fake' | 'langgraph' | 'ag_ui';

export interface InstallOption {
  readonly key: InstallVariant;
  readonly label: string;
  readonly description: string;
  readonly command: string;
  readonly peersNote: string;
  readonly providerSnippet: string;
  readonly quickstartHref: string;
}

export const COMPONENT_SNIPPET = `import { Component } from '@angular/core';
import { injectAgent } from '@threadplane/langgraph';
import { ChatComponent } from '@threadplane/chat';

@Component({
  imports: [ChatComponent],
  template: \`<chat [agent]="agent" />\`,
})
export class SupportAgentComponent {
  protected readonly agent = injectAgent();
}`;

/**
 * Step 3 of the mechanism section: registering your own design-system
 * components so generated UI can only render what you already own.
 * Mirrors the real API — `provideViews(views({ … }))` from @threadplane/render.
 */
export const RENDER_SNIPPET = `import { ApplicationConfig } from '@angular/core';
import { provideViews, views } from '@threadplane/render';
import { KpiCardComponent } from './kpi-card.component';
import { DisruptionsTableComponent } from './disruptions-table.component';

export const appConfig: ApplicationConfig = {
  providers: [
    // Generated UI can render these components and nothing else.
    provideViews(views({
      KpiCard: KpiCardComponent,
      DisruptionsTable: DisruptionsTableComponent,
    })),
  ],
};`;

export const INSTALL_OPTIONS: readonly InstallOption[] = [
  {
    key: 'fake',
    label: 'Try without a backend',
    description: 'Runs a fake agent in the browser. Swap in a real adapter when the UI works.',
    command: 'npm install @threadplane/chat @threadplane/langgraph @langchain/core @langchain/langgraph-sdk marked',
    peersNote: `${formatAngularRange(WEBSITE_SUPPORTED_ANGULAR_MAJORS)} · the LangGraph SDK is a peer of the adapter, marked a peer of the chat package`,
    providerSnippet: `import { ApplicationConfig } from '@angular/core';
import { provideFakeAgent } from '@threadplane/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [
    provideFakeAgent({ tokens: ['Hello', ' from', ' Threadplane'] }),
  ],
};`,
    quickstartHref: '/docs/chat/getting-started/try-without-a-backend',
  },
  {
    key: 'langgraph',
    label: 'LangGraph',
    description: 'Connect a LangGraph Platform or langgraph dev server.',
    command: 'npm install @threadplane/chat @threadplane/langgraph @langchain/core @langchain/langgraph-sdk marked',
    peersNote: `${formatAngularRange(WEBSITE_SUPPORTED_ANGULAR_MAJORS)} · the LangGraph SDK is a peer of the adapter, marked a peer of the chat package`,
    providerSnippet: `import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ apiUrl: 'http://localhost:2024', assistantId: 'agent' }),
  ],
};`,
    quickstartHref: '/docs/langgraph/getting-started/quickstart',
  },
  {
    key: 'ag_ui',
    label: 'AG-UI',
    description: 'Connect any AG-UI-compatible endpoint.',
    command: 'npm install @threadplane/chat @threadplane/ag-ui @ag-ui/client @ag-ui/core marked',
    peersNote: `${formatAngularRange(WEBSITE_SUPPORTED_ANGULAR_MAJORS)} · the AG-UI client is a peer of the adapter, marked a peer of the chat package`,
    providerSnippet: `import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/ag-ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ url: 'http://localhost:8000/agent' }),
  ],
};`,
    quickstartHref: '/docs/ag-ui/getting-started/quickstart',
  },
];

/**
 * Spec §3.4: the stage's last screen. `install` is derived from the install
 * options so the command lives in one place; the fake-agent command is a
 * single line, so it is shown whole. Declared after INSTALL_OPTIONS on purpose.
 */
export const STAGE_CLOSE = {
  claim: 'Feature complete for the final mile.',
  install: INSTALL_OPTIONS[0].command,
  cta: { label: 'Spike it this week', href: INSTALL_OPTIONS[0].quickstartHref },
} as const;

// ── Coding-agent quickstart prompt ───────────────────────────────────────────
export const CODING_AGENT_PROMPT = `Add Threadplane to this Angular application.

1. Read https://threadplane.ai/AGENTS.md and the current Threadplane quickstart.
2. Inspect this repository's Angular version, application configuration, design
   system, test runner, and existing agent/backend code.
3. Begin with Threadplane's provideFakeAgent() path so the UI can be verified
   without a server or LLM.
4. Render the smallest accessible <chat> experience using the app's existing
   layout and styles.
5. Add a focused test for the integration.
6. After the fake path passes, explain the exact configuration needed for
   either LangGraph or AG-UI. Do not invent credentials, endpoint URLs, or
   backend capabilities.
7. Run the repository's relevant lint, test, and build commands and report
   every changed file.`;

// ── OG image + keywords (unchanged) ─────────────────────────────────────────
export interface PositioningProofPoint {
  readonly label: string;
  readonly href: string;
}

export const POSITIONING_PROOF_POINTS: readonly PositioningProofPoint[] = [
  { label: 'LangGraph + AG-UI', href: '/docs/choosing-an-adapter' },
  { label: 'Durable threads', href: '/docs/langgraph/guides/persistence' },
  { label: 'Interrupts', href: '/docs/langgraph/guides/interrupts' },
  { label: 'Subagents', href: '/docs/langgraph/guides/subgraphs' },
  { label: 'Planning + memory', href: '/docs/langgraph/guides/memory' },
  { label: 'json-render + A2UI', href: '/docs/render/concepts/json-render-vs-a2ui' },
] as const;
export const SHORT_POSITIONING_DESCRIPTION = HOME_DESCRIPTION;
export const DEFAULT_META_DESCRIPTION = SHORT_POSITIONING_DESCRIPTION;
