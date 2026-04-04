import { codeToHtml } from 'shiki';
import { tokens } from '../../../lib/design-tokens';
import { CapabilityCard } from './CapabilityCard';

const CAPABILITIES = [
  {
    icon: '\u26A1',
    title: 'Streaming',
    description: 'Surface intermediate progress while the graph runs. Token-by-token updates arrive via SSE and land directly in Angular Signals.',
    code: `// Token-by-token streaming
const chat = streamResource<ChatState>({
  assistantId: 'chat_agent',
});

// Tokens arrive in real-time
@for (msg of chat.messages(); track $index) {
  <p [class.streaming]="$last">
    {{ msg.content }}
  </p>
}`,
    lang: 'typescript' as const,
  },
  {
    icon: '\uD83D\uDCBE',
    title: 'Persistence',
    description: 'Execution state survives retries and resumptions. Thread-based checkpoint recovery means users never lose their conversation.',
    code: `// Thread persistence across sessions
const chat = streamResource<ChatState>({
  assistantId: 'agent',
  threadId: signal(localStorage.getItem('tid')),
  onThreadId: (id) => {
    localStorage.setItem('tid', id);
  },
});`,
    lang: 'typescript' as const,
  },
  {
    icon: '\u270B',
    title: 'Interrupts',
    description: 'Pause execution for human decisions \u2014 approvals, confirmations, corrections. Resume without losing any context or state.',
    code: `// Human-in-the-loop approval
const agent = streamResource<AgentState>({
  assistantId: 'approval_agent',
  onInterrupt: (data) => {
    this.approval.set(data);
  },
});

// User approves \u2192 resume
agent.submit({ resume: { approved: true } });`,
    lang: 'typescript' as const,
  },
  {
    icon: '\u23EA',
    title: 'Time Travel',
    description: 'Inspect earlier states and replay alternate execution paths. Debug agent decisions by stepping through the full state history.',
    code: `// Browse execution history
const history = agent.history();

// Fork from a previous state
agent.submit({
  checkpoint: history[2].checkpoint,
  messages: [{ role: 'user', content: 'Try again' }],
});`,
    lang: 'typescript' as const,
  },
];

export async function LangGraphShowcase() {
  const cards = await Promise.all(
    CAPABILITIES.map(async (cap) => ({
      ...cap,
      codeHtml: await codeToHtml(cap.code, { lang: cap.lang, theme: 'tokyo-night' }),
    })),
  );

  return (
    <section className="px-8 py-20 max-w-6xl mx-auto">
      <p className="font-mono text-xs uppercase tracking-widest mb-4 text-center"
        style={{ color: tokens.colors.accent }}>LangGraph Capabilities</p>
      <h2 style={{
        fontFamily: 'var(--font-garamond)',
        fontWeight: 800,
        fontSize: 'clamp(28px, 3.5vw, 48px)',
        color: tokens.colors.textPrimary,
        textAlign: 'center',
        marginBottom: 48,
      }}>Every LangGraph feature, natively in Angular</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {cards.map((card, i) => (
          <CapabilityCard
            key={card.title}
            icon={card.icon}
            title={card.title}
            description={card.description}
            codeHtml={card.codeHtml}
            tint="blue"
            index={i}
          />
        ))}
      </div>
    </section>
  );
}
