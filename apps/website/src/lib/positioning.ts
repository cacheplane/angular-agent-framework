export const PRIMARY_TAGLINE =
  'Threadplane. Durable threads, interrupts, subagents, planning, memory, and generative UI.';
export const LONG_SUBHEAD =
  'The fullstack agentic Angular framework for LangGraph and AG-UI-compatible agents: durable threads, interrupts, subagents, planning, memory, and generative UI using Vercel json-render and Google A2UI.';
export const HERO_SUBHEAD = `The streaming demo takes an afternoon. Everything after it takes six months. Threadplane is the Angular layer that closes the gap — and it keeps your backend exactly where it is.`;

export interface HeroCapability {
  readonly label: string;
  readonly href: string;
}

/**
 * The hero's single capability row (spec 2026-08-31): chip casing, proof-pill
 * hrefs, rendered as links. POSITIONING_PROOF_POINTS still feeds the OG image
 * and metadata keywords — do not fold these together.
 */
export const HERO_CAPABILITIES: readonly HeroCapability[] = [
  { label: 'durable threads', href: '/docs/langgraph/guides/persistence' },
  { label: 'interrupts', href: '/docs/langgraph/guides/interrupts' },
  { label: 'subagents', href: '/docs/langgraph/guides/subgraphs' },
  { label: 'planning + memory', href: '/docs/langgraph/guides/memory' },
  { label: 'generative UI', href: '/docs/render/concepts/json-render-vs-a2ui' },
  { label: 'LangGraph + AG-UI', href: '/docs/choosing-an-adapter' },
];
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
export const SHORT_POSITIONING_DESCRIPTION =
  'Production-ready chat, durable threads, interrupts, subagents, planning, memory, and generative UI for agentic Angular apps.';
export const DEFAULT_META_DESCRIPTION = SHORT_POSITIONING_DESCRIPTION;
