# Homepage Expansion — Rich AI Startup Landing Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the homepage from 4 sections to 9 with interactive tabbed value props, capability showcases with code examples for LangGraph and Deep Agents, a cockpit CTA, and a stats strip.

**Architecture:** New sections are React components in `apps/website/src/components/landing/`. Components needing both Shiki code highlighting (server-side async) and interactivity (client-side state) use a server/client split: server component pre-renders code HTML via `codeToHtml()`, passes it as props to a `'use client'` child that handles tabs/toggles. All styling uses `tokens` from `design-tokens.ts` and the glass/gradient system.

**Tech Stack:** Next.js 16, React 19, Shiki (tokyo-night), Framer Motion, design tokens

**Spec:** See approved plan at `/Users/blove/.claude/plans/splendid-munching-platypus.md`

---

### Task 1: Create ValueProps — Interactive Tabbed Section

**Files:**
- Create: `apps/website/src/components/landing/ValueProps.tsx`
- Create: `apps/website/src/components/landing/ValuePropsTabs.tsx`

This section shows 3 tabbed value propositions, each with explanation text and a syntax-highlighted code example. The server component (`ValueProps`) renders code via Shiki and passes HTML to the client component (`ValuePropsTabs`) which handles tab switching.

- [ ] **Step 1: Create the client tab switcher component**

Create `apps/website/src/components/landing/ValuePropsTabs.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

interface Tab {
  id: string;
  label: string;
  headline: string;
  description: string;
  codeHtml: string;
}

export function ValuePropsTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0);

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex gap-2 mb-8 justify-center flex-wrap">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => setActive(i)}
            className="px-5 py-2.5 rounded-lg font-mono text-sm transition-all"
            style={{
              background: active === i ? tokens.colors.accentSurface : 'transparent',
              color: active === i ? tokens.colors.accent : tokens.colors.textSecondary,
              border: `1px solid ${active === i ? tokens.colors.accentBorderHover : 'transparent'}`,
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tabs[active].id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* Left: explanation */}
          <div className="p-8 rounded-xl" style={{
            background: tokens.glass.bg,
            backdropFilter: `blur(${tokens.glass.blur})`,
            WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
            border: `1px solid ${tokens.glass.border}`,
          }}>
            <h3 style={{
              fontFamily: 'var(--font-garamond)',
              fontWeight: 700,
              fontSize: '1.5rem',
              color: tokens.colors.textPrimary,
              marginBottom: 12,
            }}>{tabs[active].headline}</h3>
            <p style={{
              fontSize: '0.95rem',
              color: tokens.colors.textSecondary,
              lineHeight: 1.7,
            }}>{tabs[active].description}</p>
          </div>

          {/* Right: code */}
          <div style={{
            borderRadius: 12,
            border: `1px solid ${tokens.glass.border}`,
            boxShadow: tokens.glass.shadow,
            overflow: 'hidden',
          }}>
            <div
              className="text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: tabs[active].codeHtml }}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Create the server component that renders code and wraps tabs**

Create `apps/website/src/components/landing/ValueProps.tsx`:

```tsx
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
    <section className="px-8 py-20 max-w-6xl mx-auto">
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
```

- [ ] **Step 3: Verify it compiles**

Run: `npx nx build website --skip-nx-cache 2>&1 | tail -10`
Expected: No import errors for ValueProps or ValuePropsTabs

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/ValueProps.tsx apps/website/src/components/landing/ValuePropsTabs.tsx
git commit -m "feat(website): add interactive tabbed ValueProps section"
```

---

### Task 2: Create LangGraphShowcase — Capability Cards with Code

**Files:**
- Create: `apps/website/src/components/landing/LangGraphShowcase.tsx`
- Create: `apps/website/src/components/landing/CapabilityCard.tsx`

A 2-column grid of capability cards, each showing a LangGraph feature with a small code snippet. The `CapabilityCard` is a reusable client component (used by both LangGraph and Deep Agents showcases). The `LangGraphShowcase` is a server component that renders code via Shiki.

- [ ] **Step 1: Create the reusable CapabilityCard client component**

Create `apps/website/src/components/landing/CapabilityCard.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

interface Props {
  icon: string;
  title: string;
  description: string;
  codeHtml: string;
  tint: 'blue' | 'red';
  cockpitHref?: string;
  index: number;
}

export function CapabilityCard({ icon, title, description, codeHtml, tint, cockpitHref, index }: Props) {
  const [expanded, setExpanded] = useState(false);
  const borderColor = tint === 'blue' ? 'rgba(0, 64, 144, 0.2)' : 'rgba(221, 0, 49, 0.2)';
  const hoverBorder = tint === 'blue' ? 'rgba(0, 64, 144, 0.4)' : 'rgba(221, 0, 49, 0.4)';
  const hoverGlow = tint === 'blue' ? '0 0 24px rgba(0,64,144,0.1)' : '0 0 24px rgba(221,0,49,0.1)';

  return (
    <motion.div
      className="rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${borderColor}`,
        background: tokens.glass.bg,
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
      }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      whileHover={{ borderColor: hoverBorder, boxShadow: hoverGlow }}>

      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span style={{ fontSize: '1.25rem' }} aria-hidden="true">{icon}</span>
            <h3 style={{
              fontFamily: 'var(--font-garamond)',
              fontWeight: 700,
              fontSize: '1.1rem',
              color: tokens.colors.textPrimary,
            }}>{title}</h3>
          </div>
        </div>
        <p style={{ fontSize: '0.875rem', color: tokens.colors.textSecondary, lineHeight: 1.6, marginBottom: 12 }}>
          {description}
        </p>
        <button
          onClick={() => setExpanded(!expanded)}
          className="font-mono text-xs transition-colors"
          style={{ color: tokens.colors.accent }}>
          {expanded ? '▾ Hide code' : '▸ Show code'}
        </button>
        {cockpitHref && (
          <a href={cockpitHref} className="font-mono text-xs ml-4 transition-colors" style={{ color: tokens.colors.textMuted }}>
            View in Cockpit →
          </a>
        )}
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${borderColor}` }}>
          <div
            className="text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: codeHtml }}
          />
        </div>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 2: Create the LangGraphShowcase server component**

Create `apps/website/src/components/landing/LangGraphShowcase.tsx`:

```tsx
import { codeToHtml } from 'shiki';
import { tokens } from '../../../lib/design-tokens';
import { CapabilityCard } from './CapabilityCard';

const CAPABILITIES = [
  {
    icon: '⚡',
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
    icon: '💾',
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
    icon: '✋',
    title: 'Interrupts',
    description: 'Pause execution for human decisions — approvals, confirmations, corrections. Resume without losing any context or state.',
    code: `// Human-in-the-loop approval
const agent = streamResource<AgentState>({
  assistantId: 'approval_agent',
  onInterrupt: (data) => {
    this.approval.set(data);
  },
});

// User approves → resume
agent.submit({ resume: { approved: true } });`,
    lang: 'typescript' as const,
  },
  {
    icon: '⏪',
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
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/CapabilityCard.tsx apps/website/src/components/landing/LangGraphShowcase.tsx
git commit -m "feat(website): add LangGraph capability showcase with code examples"
```

---

### Task 3: Create DeepAgentsShowcase — Capability Cards with Code

**Files:**
- Create: `apps/website/src/components/landing/DeepAgentsShowcase.tsx`

Uses the same `CapabilityCard` component from Task 2 but with red tint for the Angular/Deep Agents side.

- [ ] **Step 1: Create the DeepAgentsShowcase server component**

Create `apps/website/src/components/landing/DeepAgentsShowcase.tsx`:

```tsx
import { codeToHtml } from 'shiki';
import { tokens } from '../../../lib/design-tokens';
import { CapabilityCard } from './CapabilityCard';

const CAPABILITIES = [
  {
    icon: '📋',
    title: 'Planning',
    description: 'Turn high-level goals into ordered action sequences with explicit constraints and checkpoints. The agent chooses next steps grounded in real context.',
    code: `// Agent plans and executes steps
const planner = streamResource<PlanState>({
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
    icon: '🔀',
    title: 'Subagents',
    description: 'Split complex tasks into focused workers with clear ownership boundaries. Each subagent handles a specialized piece and reports back.',
    code: `// Orchestrator delegates to subagents
const orchestrator = streamResource<OrchestratorState>({
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
    icon: '🧩',
    title: 'Skills',
    description: 'Package repeatable agent behavior into focused, reusable instruction sets. Skills define scope, response format, and operational boundaries.',
    code: `// Agent uses a skill for code review
const reviewer = streamResource<ReviewState>({
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
    icon: '🧠',
    title: 'Memory',
    description: 'Retain useful intermediate context across agent turns without leaking irrelevant history. Memory shapes routing and improves response quality over time.',
    code: `// Agent with persistent memory
const agent = streamResource<MemoryState>({
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
    <section className="px-8 py-20 max-w-6xl mx-auto">
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/DeepAgentsShowcase.tsx
git commit -m "feat(website): add Deep Agents capability showcase with code examples"
```

---

### Task 4: Create CockpitCTA — Call to Action Section

**Files:**
- Create: `apps/website/src/components/landing/CockpitCTA.tsx`

A `'use client'` component with a large glass panel showing a wireframe mockup of the cockpit and two CTA buttons.

- [ ] **Step 1: Create the CockpitCTA component**

Create `apps/website/src/components/landing/CockpitCTA.tsx`:

```tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

export function CockpitCTA() {
  return (
    <section className="px-8 py-20 max-w-5xl mx-auto">
      <motion.div
        className="rounded-2xl p-10 md:p-14"
        style={{
          background: tokens.glass.bg,
          backdropFilter: `blur(${tokens.glass.blur})`,
          WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`,
          boxShadow: tokens.glass.shadow,
        }}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}>

        <p className="font-mono text-xs uppercase tracking-widest mb-4 text-center"
          style={{ color: tokens.colors.accent }}>Interactive Reference</p>
        <h2 style={{
          fontFamily: 'var(--font-garamond)',
          fontWeight: 800,
          fontSize: 'clamp(28px, 3.5vw, 48px)',
          color: tokens.colors.textPrimary,
          textAlign: 'center',
          marginBottom: 12,
        }}>Explore the Cockpit</h2>
        <p className="text-center mb-10" style={{ color: tokens.colors.textSecondary, maxWidth: '55ch', margin: '0 auto 40px', lineHeight: 1.6 }}>
          Interactive reference implementations for every capability. Run examples, inspect source code, and read guided documentation — all in one place.
        </p>

        {/* Cockpit wireframe mockup */}
        <div className="rounded-xl overflow-hidden mb-10" style={{
          border: `1px solid ${tokens.colors.accentBorder}`,
          background: '#080B14',
        }}>
          {/* Mock toolbar */}
          <div style={{
            padding: '8px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF5F57' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FEBC2E' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28C840' }} />
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              {['Run', 'Code', 'Docs'].map((tab, i) => (
                <span key={tab} style={{
                  padding: '3px 12px', borderRadius: 4,
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: i === 0 ? '#6C8EFF' : '#4A527A',
                  background: i === 0 ? 'rgba(108,142,255,0.12)' : 'transparent',
                }}>{tab}</span>
              ))}
            </div>
          </div>
          {/* Mock content */}
          <div style={{ display: 'flex', minHeight: 140 }}>
            {/* Sidebar */}
            <div style={{ width: 160, borderRight: '1px solid rgba(255,255,255,0.06)', padding: '10px 8px' }}>
              {['LangGraph', 'Streaming', 'Persistence', 'Interrupts'].map((item, i) => (
                <div key={item} style={{
                  padding: '4px 8px', borderRadius: 4, marginBottom: 2,
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: i === 1 ? '#6C8EFF' : '#4A527A',
                  background: i === 1 ? 'rgba(108,142,255,0.08)' : 'transparent',
                }}>{item}</div>
              ))}
            </div>
            {/* Main area */}
            <div style={{ flex: 1, padding: 14 }}>
              <div style={{ fontFamily: 'var(--font-garamond)', fontSize: 14, fontWeight: 700, color: '#EEF1FF', marginBottom: 8 }}>
                LangGraph Streaming
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3].map(n => (
                  <div key={n} style={{ flex: 1, height: 40, borderRadius: 4, background: 'rgba(108,142,255,0.04)', border: '1px solid rgba(108,142,255,0.08)' }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-8 mb-10 flex-wrap">
          {[
            { value: '14+', label: 'Capabilities' },
            { value: '2', label: 'Products' },
            { value: '3', label: 'View Modes' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: tokens.colors.accent }}>{s.value}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex justify-center gap-4 flex-wrap">
          <a href="/docs" className="px-6 py-3 rounded-lg font-mono text-sm transition-all"
            style={{ background: tokens.colors.accent, color: '#fff', textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = tokens.glow.button)}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}>
            Launch Cockpit
          </a>
          <a href="/docs" className="px-6 py-3 rounded-lg font-mono text-sm transition-all"
            style={{ border: `1px solid ${tokens.colors.accent}`, color: tokens.colors.accent, textDecoration: 'none' }}>
            Read Docs
          </a>
        </div>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/CockpitCTA.tsx
git commit -m "feat(website): add CockpitCTA section with mockup and CTAs"
```

---

### Task 5: Create StatsStrip — Social Proof Numbers

**Files:**
- Create: `apps/website/src/components/landing/StatsStrip.tsx`

A horizontal strip of key stats in glass containers.

- [ ] **Step 1: Create the StatsStrip component**

Create `apps/website/src/components/landing/StatsStrip.tsx`:

```tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

const STATS = [
  { value: '14+', label: 'Capabilities' },
  { value: '100%', label: 'useStream() Parity' },
  { value: '20+', label: 'Angular Version' },
  { value: 'OSS', label: 'Source Available' },
];

export function StatsStrip() {
  return (
    <section className="px-8 py-16 max-w-5xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="text-center py-8 rounded-xl"
            style={{
              background: tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              border: `1px solid ${tokens.glass.border}`,
            }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.4 }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'clamp(28px, 3vw, 40px)',
              fontWeight: 700,
              color: tokens.colors.accent,
              marginBottom: 4,
            }}>{stat.value}</div>
            <div style={{
              fontFamily: 'var(--font-garamond)',
              fontSize: '0.9rem',
              color: tokens.colors.textSecondary,
            }}>{stat.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/StatsStrip.tsx
git commit -m "feat(website): add StatsStrip social proof section"
```

---

### Task 6: Wire Up All New Sections in page.tsx

**Files:**
- Modify: `apps/website/src/app/page.tsx`

- [ ] **Step 1: Update page.tsx with all new sections and additional gradient blobs**

```tsx
import { HeroTwoCol } from '../components/landing/HeroTwoCol';
import { ArchDiagram } from '../components/landing/ArchDiagram';
import { ValueProps } from '../components/landing/ValueProps';
import { LangGraphShowcase } from '../components/landing/LangGraphShowcase';
import { DeepAgentsShowcase } from '../components/landing/DeepAgentsShowcase';
import { FeatureStrip } from '../components/landing/FeatureStrip';
import { CodeBlock } from '../components/landing/CodeBlock';
import { CockpitCTA } from '../components/landing/CockpitCTA';
import { StatsStrip } from '../components/landing/StatsStrip';
import { tokens } from '../../lib/design-tokens';

export default async function HomePage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      {/* Ambient gradient blobs */}
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: tokens.gradient.warm, top: -200, left: -150, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.cool, top: 800, right: -100, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: tokens.gradient.warm, top: 2000, left: -100, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.cool, top: 3500, right: -150, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: tokens.gradient.coolLight, top: 5000, left: '30%', filter: 'blur(70px)', pointerEvents: 'none' }} />

      <HeroTwoCol />
      <ArchDiagram />
      <ValueProps />
      <LangGraphShowcase />
      <DeepAgentsShowcase />
      <FeatureStrip />
      <CodeBlock />
      <CockpitCTA />
      <StatsStrip />
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Open http://localhost:3000 and scroll through the full page. Verify all 9 sections render without errors.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/app/page.tsx
git commit -m "feat(website): wire up all new homepage sections"
```

---

### Task 7: Visual Review and Final Fixes

- [ ] **Step 1: Full page scroll verification**

Open http://localhost:3000 and verify:
- Hero with agent animation
- Architecture diagram (two-row)
- ValueProps tabs work (click each tab, see code + explanation)
- LangGraph showcase cards (4 cards, blue tint, code expand/collapse)
- Deep Agents showcase cards (4 cards, red tint, code expand/collapse)
- Feature strip (6 glass cards)
- Code block (30-second example)
- Cockpit CTA (mockup + buttons)
- Stats strip (4 glass stat boxes)
- Gradient blobs flow naturally throughout

- [ ] **Step 2: Fix any issues found**

- [ ] **Step 3: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix(website): polish homepage section layout and spacing"
```
