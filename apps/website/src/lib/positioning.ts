export const PRIMARY_TAGLINE =
  'Threadplane. Durable threads, interrupts, subagents, planning, memory, and generative UI.';
export const LONG_SUBHEAD =
  'The fullstack agentic Angular framework for LangGraph and AG-UI-compatible agents: durable threads, interrupts, subagents, planning, memory, and generative UI using Vercel json-render and Google A2UI.';
export const HERO_SUBHEAD = `Build fullstack agentic apps in Angular with: durable threads, interrupts, subagents, planning, memory, and generative UI using Vercel json-render and Google A2UI.`;
export interface PositioningProofPoint {
  readonly label: string;
  readonly href: string;
}

export const POSITIONING_PROOF_POINTS: readonly PositioningProofPoint[] = [
  { label: 'LangGraph + AG-UI', href: '/docs/langgraph/concepts/langgraph-basics' },
  { label: 'Durable threads', href: '/docs/langgraph/guides/persistence' },
  { label: 'Interrupts', href: '/docs/langgraph/guides/interrupts' },
  { label: 'Subagents', href: '/docs/langgraph/guides/subgraphs' },
  { label: 'Planning + memory', href: '/docs/langgraph/guides/memory' },
  { label: 'json-render + A2UI', href: '/docs/render/concepts/json-render-vs-a2ui' },
] as const;
export const SHORT_POSITIONING_DESCRIPTION =
  'Production-ready chat, durable threads, interrupts, subagents, planning, memory, and generative UI for agentic Angular apps.';
export const DEFAULT_META_DESCRIPTION = SHORT_POSITIONING_DESCRIPTION;
