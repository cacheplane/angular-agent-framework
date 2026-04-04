import { codeToHtml } from 'shiki';
import { tokens } from '../../../lib/design-tokens';
import { ValuePropsTabs } from './ValuePropsTabs';

const TAB_DATA = [
  {
    id: 'reactive',
    label: 'Reactive by Default',
    headline: 'Every State Slice is a Signal',
    description: 'streamResource() exposes messages, status, error, and threadId as Angular Signals. Compose them with computed(), bind them in templates, and let OnPush change detection handle the rest. No manual subscriptions. No RxJS boilerplate.',
    code: `// chat.component.ts
const chat = streamResource<ChatState>({
  assistantId: 'agent',
});

// Every property is a Signal
const messages = chat.messages();   // Signal<BaseMessage[]>
const status = chat.status();       // Signal<'idle' | 'streaming'>
const error = chat.error();         // Signal<Error | null>

// Reactive composition
const lastMessage = computed(() =>
  chat.messages().at(-1)?.content ?? ''
);`,
    lang: 'typescript' as const,
  },
  {
    id: 'agents',
    label: 'Built for Agents',
    headline: 'Full Agent Lifecycle Support',
    description: 'Handle interrupts for human-in-the-loop approval, process tool calls, navigate branch history, and manage subagent delegation. Every LangGraph agent pattern has a first-class Angular API — no React translation layer needed.',
    code: `// approval.component.ts
const agent = streamResource<AgentState>({
  assistantId: 'approval_agent',
  onInterrupt: (interrupt) => {
    // Agent paused — surface to user
    this.pendingApproval.set(interrupt);
  },
});

// Resume after human decision
approve() {
  agent.submit({ resume: { approved: true } });
}

// Access full branch history
const branches = agent.history();`,
    lang: 'typescript' as const,
  },
  {
    id: 'testing',
    label: 'Test Everything',
    headline: 'Deterministic Agent Testing',
    description: 'MockStreamTransport lets you script exact event sequences and step through them in your specs. No flaky SSE connections, no timing issues, no running LangGraph server. Test agent behavior the same way you test any Angular service.',
    code: `// chat.component.spec.ts
const transport = new MockStreamTransport();

transport.script([
  { type: 'values', data: { messages: [aiMsg('Hello')] } },
  { type: 'values', data: { status: 'done' } },
]);

const chat = streamResource<ChatState>({
  transport,
  assistantId: 'test_agent',
});

expect(chat.messages()).toEqual([aiMsg('Hello')]);
expect(chat.status()).toBe('done');`,
    lang: 'typescript' as const,
  },
];

export async function ValueProps() {
  const tabs = await Promise.all(
    TAB_DATA.map(async (tab) => ({
      id: tab.id,
      label: tab.label,
      headline: tab.headline,
      description: tab.description,
      codeHtml: await codeToHtml(tab.code, { lang: tab.lang, theme: 'tokyo-night' }),
    })),
  );

  return (
    <section className="px-8 py-20 max-w-6xl mx-auto animate-on-scroll">
      <p className="font-mono text-xs uppercase tracking-widest mb-4 text-center"
        style={{ color: tokens.colors.accent }}>Why streamResource()?</p>
      <h2 style={{
        fontFamily: 'var(--font-garamond)',
        fontWeight: 800,
        fontSize: 'clamp(28px, 3.5vw, 48px)',
        color: tokens.colors.textPrimary,
        textAlign: 'center',
        marginBottom: 8,
      }}>Full parity with React <code style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.85em',
        background: tokens.colors.accentSurface,
        color: tokens.colors.accent,
        padding: '2px 8px',
        borderRadius: 6,
      }}>useStream()</code></h2>
      <p className="text-center mb-12" style={{ color: tokens.colors.textSecondary, maxWidth: '50ch', margin: '0 auto 48px' }}>
        Built natively for Angular 20+. No wrappers, no adapters, no compromises.
      </p>
      <ValuePropsTabs tabs={tabs} />
    </section>
  );
}
