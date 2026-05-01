import { codeToHtml } from 'shiki';
import { tokens } from '@ngaf/design-tokens';
import { CapabilityCard } from './CapabilityCard';

const CAPABILITIES = [
  {
    icon: '\uD83D\uDCCB',
    title: 'Planning',
    description: 'Turn high-level goals into ordered action sequences with explicit constraints and checkpoints. The agent chooses next steps grounded in real context.',
    code: `// Agent plans and executes steps
const planner = agent<PlanState>({
  assistantId: 'planning_agent',
});

// Stream plan steps as they're created
@for (step of planner.messages(); track $index) {
  <div [class.complete]="step.status === 'done'">
    {{ step.content }}
  </div>
}`,
    lang: 'typescript' as const,
  },
  {
    icon: '\uD83D\uDD00',
    title: 'Subagents',
    description: 'Split complex tasks into focused workers with clear ownership boundaries. Each subagent handles a specialized piece and reports back.',
    code: `// Orchestrator delegates to subagents
const orchestrator = agent<OrchestratorState>({
  assistantId: 'orchestrator',
});

// Track subagent progress
const activeWorkers = computed(() =>
  orchestrator.messages()
    .filter(m => m.type === 'subagent_start')
    .length
);`,
    lang: 'typescript' as const,
  },
  {
    icon: '\uD83E\uDDE9',
    title: 'Skills',
    description: 'Package repeatable agent behavior into focused, reusable instruction sets. Skills define scope, response format, and operational boundaries.',
    code: `// Agent uses a skill for code review
const reviewer = agent<ReviewState>({
  assistantId: 'code_review_skill',
  input: {
    files: changedFiles(),
    guidelines: teamStandards,
  },
});

// Structured skill output
const issues = reviewer.messages()
  .filter(m => m.type === 'issue');`,
    lang: 'typescript' as const,
  },
  {
    icon: '\uD83E\uDDE0',
    title: 'Memory',
    description: 'Retain useful intermediate context across agent turns without leaking irrelevant history. Memory shapes routing and improves response quality over time.',
    code: `// Agent with persistent memory
const agent = agent<MemoryState>({
  assistantId: 'memory_agent',
  threadId: signal(userId()),
});

// Memory persists across conversations
// Agent recalls user preferences,
// past decisions, and project context
agent.submit({
  messages: [{ role: 'user', content: query }],
});`,
    lang: 'typescript' as const,
  },
];

export async function DeepAgentsShowcase() {
  const cards = await Promise.all(
    CAPABILITIES.map(async (cap) => ({
      ...cap,
      codeHtml: await codeToHtml(cap.code, { lang: cap.lang, theme: 'tokyo-night' }),
    })),
  );

  return (
    <section className="px-8 py-20 max-w-6xl mx-auto animate-on-scroll">
      <p className="font-mono text-xs uppercase tracking-widest mb-4 text-center"
        style={{ color: tokens.colors.angularRed }}>Deep Agents Capabilities</p>
      <h2 style={{
        fontFamily: 'var(--font-garamond)',
        fontWeight: 800,
        fontSize: 'clamp(28px, 3.5vw, 48px)',
        color: tokens.colors.textPrimary,
        textAlign: 'center',
        marginBottom: 48,
      }}>Multi-step agent workflows with explicit control</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {cards.map((card, i) => (
          <CapabilityCard
            key={card.title}
            icon={card.icon}
            title={card.title}
            description={card.description}
            codeHtml={card.codeHtml}
            tint="red"
            index={i}
          />
        ))}
      </div>
    </section>
  );
}
