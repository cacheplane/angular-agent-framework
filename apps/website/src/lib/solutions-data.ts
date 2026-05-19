export interface SolutionPainPoint {
  title: string;
  description: string;
}

export interface ArchitectureLayer {
  library: string;
  pkg: string;
  role: string;
}

/**
 * Framework capability — paired short marker with a longer label.
 * Used to be a numeric "proof point" with invented metrics; replaced
 * with honest, defensible capability claims grounded in what the
 * libraries actually do.
 */
export interface ProofPoint {
  metric: string;
  label: string;
}

export interface SolutionConfig {
  slug: string;
  color: string;
  rgb: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  painPoints: SolutionPainPoint[];
  architectureIntro: string;
  architectureLayers: ArchitectureLayer[];
  proofPoints: ProofPoint[];
  ctaHeadline: string;
  ctaSubtext: string;
  metaTitle: string;
  metaDescription: string;
}

export const SOLUTIONS: SolutionConfig[] = [
  {
    slug: 'compliance',
    color: '#D4850F',
    rgb: '212,133,15',
    eyebrow: 'Compliance & Audit',
    title: 'AI agents your compliance\nteam will actually approve',
    subtitle: 'Human-in-the-loop approvals, auditable thread history, and deterministic testing — built into the framework, not bolted on.',
    painPoints: [
      {
        title: 'Black-box AI decisions',
        description: 'Regulators require explainability. Most agent frameworks stream opaque outputs with no tool-call history.',
      },
      {
        title: 'No human gate before action',
        description: 'SOX, HIPAA, and GDPR demand human approval before consequential actions. Retrofitting interrupts is a rewrite.',
      },
      {
        title: 'Untestable agent behavior',
        description: 'Compliance needs reproducible test evidence. Non-deterministic LLM calls make that nearly impossible without the right tooling.',
      },
    ],
    architectureIntro: 'Three libraries give your compliance team what they need — without slowing your engineering team down.',
    architectureLayers: [
      {
        library: 'Agent',
        pkg: '@ngaf/langgraph',
        role: 'Production agent state with first-class interrupt support. Every agent action can require human approval before execution. Durable thread persistence preserves the full record of every tool call and state transition.',
      },
      {
        library: 'Render',
        pkg: '@ngaf/render',
        role: 'Approval workflows rendered as structured UI — not chat messages. The agent proposes an action, renders a confirmation card, and waits for the human gate before proceeding.',
      },
      {
        library: 'Chat',
        pkg: '@ngaf/chat',
        role: 'Debug overlay shows every tool call, interrupt, and state transition. Your compliance team can review exactly what happened, when, and why — in a UI they can understand.',
      },
    ],
    proofPoints: [
      { metric: 'Every', label: 'Agent action recorded — tool calls, interrupts, and state transitions captured in the thread record' },
      { metric: 'Required', label: 'Human approval before consequential actions — wired into LangGraph interrupts, not bolted on' },
      { metric: 'Replayable', label: 'Thread persistence preserves the full decision path for review by auditors and your compliance team' },
    ],
    ctaHeadline: 'Ship compliant AI agents — without the compliance tax',
    ctaSubtext: 'Download the field report or start a pilot. Your compliance team will thank you.',
    metaTitle: 'Compliance & Audit — Agent UI for Angular Solutions',
    metaDescription: 'Ship AI agents with human-in-the-loop approvals, auditable thread history, and deterministic testing. Built for SOX, HIPAA, and GDPR workflows.',
  },
  {
    slug: 'analytics',
    color: '#0F7B8D',
    rgb: '15,123,141',
    eyebrow: 'Analytics & BI',
    title: 'Natural language queries.\nReal-time dashboards.',
    subtitle: 'Your users ask questions in plain English. The agent queries, visualizes, and streams results — all inside your Angular app.',
    painPoints: [
      {
        title: 'BI tools users won\'t adopt',
        description: 'Complex dashboards with steep learning curves. Business users want answers, not another tool to learn.',
      },
      {
        title: 'Static reports, stale data',
        description: 'Pre-built dashboards can\'t answer ad-hoc questions. By the time a report is built, the question has changed.',
      },
      {
        title: 'Chat-only AI interfaces',
        description: 'Text answers aren\'t enough for data. Users need charts, tables, and interactive visualizations — streamed in real time.',
      },
    ],
    architectureIntro: 'Three libraries turn your LangGraph agent into a conversational BI surface your business users will actually use.',
    architectureLayers: [
      {
        library: 'Agent',
        pkg: '@ngaf/langgraph',
        role: 'Streams query results token-by-token as the LangGraph agent reasons over your data. Thread persistence means users can refine questions without re-running expensive queries.',
      },
      {
        library: 'Render',
        pkg: '@ngaf/render',
        role: 'The agent emits chart specs, data tables, and KPI cards as structured render specs. Your Angular components render them with streaming JSON patches — live-updating visualizations as data arrives.',
      },
      {
        library: 'Chat',
        pkg: '@ngaf/chat',
        role: 'Generative UI surfaces render charts and tables inline with the conversation. Users ask follow-up questions and see updated visualizations without leaving the chat.',
      },
    ],
    proofPoints: [
      { metric: 'Plain English', label: 'No SQL required — the agent generates queries from natural-language input' },
      { metric: 'Streaming', label: 'Token-level updates as the agent reasons over your data — first results visible before completion' },
      { metric: 'Inline', label: 'Charts, tables, and KPI cards rendered into the conversation as Angular components you already own' },
    ],
    ctaHeadline: 'Turn your data into conversations',
    ctaSubtext: 'Download the field report or start a pilot. Ship a conversational BI experience in weeks, not quarters.',
    metaTitle: 'Analytics & BI — Agent UI for Angular Solutions',
    metaDescription: 'Build conversational BI with natural language queries, streaming results, and generative UI — all in Angular.',
  },
  {
    slug: 'customer-support',
    color: '#5B4FCF',
    rgb: '91,79,207',
    eyebrow: 'Customer Support',
    title: 'AI agents that know when\nto escalate to a human',
    subtitle: 'Resolve routine tickets autonomously, surface context instantly, and hand off to humans seamlessly — with full conversation history.',
    painPoints: [
      {
        title: 'Chatbots that frustrate customers',
        description: 'Scripted chatbots can\'t handle nuance. Customers get stuck in loops, abandon the chat, and call the support line anyway.',
      },
      {
        title: 'Agents without guardrails',
        description: 'Autonomous agents that can\'t escalate are a liability. One wrong refund, one leaked detail, and trust is gone.',
      },
      {
        title: 'Context lost on handoff',
        description: 'When a bot hands off to a human, the conversation history disappears. The customer repeats everything. CSAT drops.',
      },
    ],
    architectureIntro: 'Three libraries give your support agents superpowers — and your customers a seamless experience.',
    architectureLayers: [
      {
        library: 'Agent',
        pkg: '@ngaf/langgraph',
        role: 'LangGraph interrupts let the agent pause before sensitive actions — refunds, account changes, escalations. Thread persistence preserves the full conversation across bot-to-human handoffs.',
      },
      {
        library: 'Render',
        pkg: '@ngaf/render',
        role: 'The agent renders structured UI — order summaries, refund confirmations, knowledge base cards — instead of dumping text. Customers see clean, actionable information.',
      },
      {
        library: 'Chat',
        pkg: '@ngaf/chat',
        role: 'Production-ready chat UI with streaming messages, tool call visibility, and interrupt panels. When the agent escalates, the human agent sees the full debug overlay with every step the AI took.',
      },
    ],
    proofPoints: [
      { metric: 'Preserved', label: 'Full conversation history across bot-to-human handoff — no repeating the question, no re-explaining the problem' },
      { metric: 'Required', label: 'Human approval gates on sensitive actions (refunds, account changes, escalations) via LangGraph interrupts' },
      { metric: 'Visible', label: 'Tool-call replay for human agents on escalation — see every step the AI took before the handoff' },
    ],
    ctaHeadline: 'Support agents that make your team better',
    ctaSubtext: 'Download the field report or start a pilot. Resolve routine tickets, escalate the rest with full context, keep your customers happy.',
    metaTitle: 'Customer Support — Agent UI for Angular Solutions',
    metaDescription: 'Build AI support agents with human escalation, full context handoff, and production-ready chat UI in Angular.',
  },
];

export function getSolutionBySlug(slug: string): SolutionConfig | undefined {
  return SOLUTIONS.find(s => s.slug === slug);
}

export function getAllSolutionSlugs(): string[] {
  return SOLUTIONS.map(s => s.slug);
}
