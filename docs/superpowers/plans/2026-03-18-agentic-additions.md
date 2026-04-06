# Angular Stream Resource — Agentic Additions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking. Set up an isolated workspace first using superpowers:using-git-worktrees.

**Goal:** Add the hero redesign, agentic docs infrastructure, and MCP server package described in the two approved specs, layered on top of the base website plan (`2026-03-18-website.md`).

**Architecture:** Three independent additions to the monorepo: (1) replace `Hero.tsx` with a two-column `HeroTwoCol.tsx` + `GenerativeUIFrame.tsx` SVG animation; (2) add `CopyPromptButton`, prompt files, `llms.txt` routes, `CLAUDE.md`/`AGENTS.md`, and a `getPromptBySlug` loader to the website; (3) scaffold `packages/mcp/` as a new Nx library publishing `@stream-resource/mcp` with six MCP tools backed by TypeDoc JSON.

**Tech Stack:** Next.js 15, TypeScript, `@modelcontextprotocol/sdk`, TypeDoc, Nx

**Specs:**
- `docs/superpowers/specs/2026-03-18-website-branding-design.md`
- `docs/superpowers/specs/2026-03-18-agentic-docs-design.md`

**Depends on:** `2026-03-18-website.md` Tasks 1–2 (Nx scaffold + design tokens) must be complete first.

---

## File Map

```
apps/website/
├── app/
│   ├── llms.txt/
│   │   └── route.ts                      # Serves /llms.txt (compact ~500 token summary)
│   └── llms-full.txt/
│       └── route.ts                      # Serves /llms-full.txt (~8k token full reference)
├── components/
│   ├── landing/
│   │   ├── HeroTwoCol.tsx                # Replaces Hero.tsx — two-column, left-aligned
│   │   └── GenerativeUIFrame.tsx         # Browser chrome SVG + CSS keyframe animation
│   └── docs/
│       └── CopyPromptButton.tsx          # 'use client' copy-to-clipboard button
├── lib/
│   └── docs.ts                           # Add getPromptBySlug() alongside existing helpers
└── content/
    └── prompts/                          # Human-authored prompt files, one per doc slug
        ├── getting-started.md
        ├── streaming.md
        ├── thread-persistence.md
        ├── configuration.md
        └── testing.md

packages/mcp/
├── src/
│   ├── index.ts                          # MCP server entry — registers all tools
│   ├── tools/
│   │   ├── get-api-reference.ts
│   │   ├── search-docs.ts
│   │   ├── get-example.ts
│   │   ├── scaffold-chat-component.ts
│   │   ├── add-stream-resource.ts
│   │   └── get-thread-persistence-pattern.ts
│   └── data/
│       └── loader.ts                     # Reads api-docs.json, exposes typed helpers
├── package.json
└── project.json
```

---

## Task 1: Hero Redesign — HeroTwoCol + GenerativeUIFrame

**Files:**
- Create: `apps/website/components/landing/HeroTwoCol.tsx`
- Create: `apps/website/components/landing/GenerativeUIFrame.tsx`
- Modify: `apps/website/app/page.tsx` (swap Hero → HeroTwoCol)
- Modify: `apps/website/app/globals.css` (add Angular red token)

### Prerequisites

Download Angular logo SVG into the project:

```bash
mkdir -p apps/website/public/logos
curl -o apps/website/public/logos/angular.svg \
  "https://angular.dev/assets/icons/logo.svg" 2>/dev/null || \
  echo '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 250"><path fill="#DD0031" d="M125 30L31.9 63.2l14.2 123.1L125 230l78.9-43.7 14.2-123.1z"/><path fill="#C3002F" d="M125 30v22.2l-61.7 162.4L125 230z"/><path fill="#fff" d="M125 52.1L66.8 182.6h21.7l11.7-29.2h49.4l11.7 29.2H183L125 52.1zm17 83.3h-34l17-40.9z"/></svg>',
```

- [ ] **Step 1: Add Angular red token to `globals.css`**

Add to `apps/website/app/globals.css` inside `:root {}`:

```css
  --color-angular-red: #DD0031;
  --color-angular-red-glow: rgba(221, 0, 49, 0.5);
```

- [ ] **Step 2: Create `GenerativeUIFrame.tsx`**

Create `apps/website/components/landing/GenerativeUIFrame.tsx`:

```tsx
'use client';
import { useEffect, useRef } from 'react';

export function GenerativeUIFrame() {
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = frame.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const distance = Math.hypot(e.clientX - cx, e.clientY - cy);
      const intensity = 0.15 + 0.45 * Math.max(0, 1 - distance / 400);
      const blur = 20 + intensity * 60;
      frame.style.boxShadow = `0 0 ${blur}px rgba(108,142,255,${intensity.toFixed(2)})`;
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      ref={frameRef}
      className="rounded-xl overflow-hidden"
      style={{
        border: '1px solid rgba(108,142,255,0.4)',
        background: '#080B14',
        boxShadow: '0 0 20px rgba(108,142,255,0.2)',
        transition: 'box-shadow 0.1s ease-out',
        width: '100%',
        maxWidth: 520,
      }}>
      {/* Browser chrome */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(108,142,255,0.15)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FEBC2E' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28C840' }} />
        </div>
        <div style={{
          flex: 1, background: 'rgba(108,142,255,0.06)',
          borderRadius: 4, padding: '3px 10px',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: '#4A527A', textAlign: 'center',
        }}>
          localhost:4200
        </div>
      </div>

      {/* Animated content area */}
      <div style={{ padding: 20, minHeight: 260, position: 'relative', overflow: 'hidden' }}>
        <style>{`
          /* Phase 1: Chat message streams in word by word */
          @keyframes fadeWord {
            from { opacity: 0; transform: translateY(4px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          /* Phase 2: Card assembles */
          @keyframes cardIn {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          /* Phase 3: Table rows appear */
          @keyframes rowIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          /* Full loop container */
          @keyframes loopFade {
            0%, 95% { opacity: 1; }
            97%, 100% { opacity: 0; }
          }
          .gen-ui-loop { animation: loopFade 6s linear infinite; }

          /* Word reveal timings — staggered across 0–1.5s */
          .w1  { animation: fadeWord 0.25s ease-out 0.1s both; }
          .w2  { animation: fadeWord 0.25s ease-out 0.3s both; }
          .w3  { animation: fadeWord 0.25s ease-out 0.5s both; }
          .w4  { animation: fadeWord 0.25s ease-out 0.7s both; }
          .w5  { animation: fadeWord 0.25s ease-out 0.9s both; }
          .w6  { animation: fadeWord 0.25s ease-out 1.1s both; }

          /* Card assembly — 1.5s → 3s */
          .card-title { animation: cardIn 0.3s ease-out 1.5s both; }
          .card-body  { animation: cardIn 0.3s ease-out 1.9s both; }
          .card-btn   { animation: cardIn 0.3s ease-out 2.3s both; }

          /* Table rows — 3s → 4.5s */
          .row1 { animation: rowIn 0.25s ease-out 3.0s both; }
          .row2 { animation: rowIn 0.25s ease-out 3.4s both; }
          .row3 { animation: rowIn 0.25s ease-out 3.8s both; }
        `}</style>

        <div className="gen-ui-loop">
          {/* Phase 1: streaming chat reply */}
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(108,142,255,0.2)', border: '1px solid rgba(108,142,255,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 9, color: '#6C8EFF',
            }}>AI</div>
            <div style={{
              background: 'rgba(108,142,255,0.08)', borderRadius: 8,
              padding: '8px 12px', fontSize: 13, color: '#EEF1FF', lineHeight: 1.5,
            }}>
              <span className="w1">Here </span>
              <span className="w2">is </span>
              <span className="w3">your </span>
              <span className="w4">quarterly </span>
              <span className="w5">report </span>
              <span className="w6">summary.</span>
            </div>
          </div>

          {/* Phase 2: generative card */}
          <div style={{
            border: '1px solid rgba(108,142,255,0.2)', borderRadius: 8,
            padding: '12px 14px', marginBottom: 12,
          }}>
            <div className="card-title" style={{
              fontFamily: 'var(--font-garamond)', fontSize: 15, fontWeight: 700,
              color: '#EEF1FF', marginBottom: 6,
            }}>Q1 2026 Revenue</div>
            <div className="card-body" style={{
              fontSize: 12, color: '#8B96C8', lineHeight: 1.5, marginBottom: 10,
            }}>Revenue up 24% YoY. Strongest quarter on record across all segments.</div>
            <div className="card-btn" style={{
              display: 'inline-block', padding: '5px 12px', borderRadius: 5,
              background: 'rgba(108,142,255,0.15)',
              border: '1px solid rgba(108,142,255,0.3)',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6C8EFF',
            }}>View details →</div>
          </div>

          {/* Phase 3: streaming table */}
          <div style={{ border: '1px solid rgba(108,142,255,0.15)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              padding: '6px 12px', background: 'rgba(108,142,255,0.06)',
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: '#4A527A', textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              <span>Segment</span><span>Revenue</span><span>Growth</span>
            </div>
            {[
              { seg: 'Enterprise', rev: '$4.2M', growth: '+31%', cls: 'row1' },
              { seg: 'SMB', rev: '$2.1M', growth: '+18%', cls: 'row2' },
              { seg: 'Developer', rev: '$0.8M', growth: '+42%', cls: 'row3' },
            ].map((r) => (
              <div key={r.seg} className={r.cls} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                padding: '6px 12px',
                borderTop: '1px solid rgba(108,142,255,0.08)',
                fontSize: 12, color: '#8B96C8',
              }}>
                <span>{r.seg}</span>
                <span style={{ color: '#EEF1FF' }}>{r.rev}</span>
                <span style={{ color: '#6C8EFF' }}>{r.growth}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `HeroTwoCol.tsx`**

Create `apps/website/components/landing/HeroTwoCol.tsx`:

```tsx
import Image from 'next/image';
import Link from 'next/link';
import { GenerativeUIFrame } from './GenerativeUIFrame';
import { CopyPromptButton } from '../docs/CopyPromptButton';
import { getPromptBySlug } from '../../lib/docs';

// LangChain monogram badge (inline — no external fetch at runtime)
function LangChainBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'rgba(108,142,255,0.08)',
      border: '1px solid rgba(108,142,255,0.15)',
      borderRadius: 20, padding: '4px 10px 4px 8px',
      fontFamily: 'var(--font-mono)', fontSize: 11, color: '#EEF1FF',
    }}>
      {/* LangChain "LC" monogram */}
      <span style={{
        width: 14, height: 14, borderRadius: 3,
        background: 'rgba(127,200,255,0.2)',
        border: '1px solid rgba(127,200,255,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 7, fontWeight: 700, color: '#7FC8FF', lineHeight: 1,
      }}>LC</span>
      LangChain
    </span>
  );
}

function AngularBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'rgba(108,142,255,0.08)',
      border: '1px solid rgba(108,142,255,0.15)',
      borderRadius: 20, padding: '4px 10px 4px 8px',
      fontFamily: 'var(--font-mono)', fontSize: 11, color: '#EEF1FF',
    }}>
      {/* Angular shield SVG inline */}
      <svg width="14" height="14" viewBox="0 0 250 250" aria-hidden>
        <path fill="#DD0031" d="M125 30L31.9 63.2l14.2 123.1L125 230l78.9-43.7 14.2-123.1z"/>
        <path fill="#C3002F" d="M125 30v22.2l-61.7 162.4 37.8 15.4z"/>
        <path fill="#fff" d="M125 52.1L66.8 182.6h21.7l11.7-29.2h49.4l11.7 29.2H183L125 52.1zm17 83.3h-34l17-40.9z"/>
      </svg>
      Angular
    </span>
  );
}

export async function HeroTwoCol() {
  const prompt = getPromptBySlug(['getting-started']) ?? '';

  return (
    <section style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center',
      padding: '96px 40px 60px',
      gap: 48,
    }}>
      {/* Left column */}
      <div style={{ flex: '0 0 55%', maxWidth: '55%' }}>
        {/* Logo badges */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
          <LangChainBadge />
          <AngularBadge />
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: 'var(--font-garamond)',
          fontSize: 'clamp(36px, 4.5vw, 72px)',
          fontWeight: 800,
          lineHeight: 1.05,
          color: '#EEF1FF',
          margin: 0,
          marginBottom: 20,
        }}>
          The Enterprise Streaming Resource for LangChain and{' '}
          <span style={{
            color: '#DD0031',
            textShadow: '0 0 30px rgba(221,0,49,0.5)',
          }}>
            Angular
          </span>
        </h1>

        {/* Subhead */}
        <p style={{
          fontFamily: 'var(--font-garamond)',
          fontStyle: 'italic',
          fontSize: 'clamp(16px, 1.8vw, 20px)',
          color: '#8B96C8',
          maxWidth: '44ch',
          lineHeight: 1.5,
          margin: 0,
          marginBottom: 32,
        }}>
          Full parity with React{' '}
          <code style={{
            fontStyle: 'normal',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8em',
            background: 'rgba(108,142,255,0.08)',
            color: '#6C8EFF',
            padding: '2px 6px',
            borderRadius: 4,
          }}>useStream()</code>
          {' '}— built natively for Angular 20+.
        </p>

        {/* Copy prompt CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
          <CopyPromptButton
            prompt={prompt}
            variant="hero"
          />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: '#4A527A',
          }}>
            npm install stream-resource
          </span>
        </div>
      </div>

      {/* Right column */}
      <div style={{ flex: '0 0 45%', maxWidth: '45%', display: 'flex', justifyContent: 'center' }}>
        <GenerativeUIFrame />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Update `app/page.tsx` to use `HeroTwoCol`**

Modify `apps/website/app/page.tsx` — swap `Hero` for `HeroTwoCol`:

```tsx
import { HeroTwoCol } from '../components/landing/HeroTwoCol';
import { ArchDiagram } from '../components/landing/ArchDiagram';
import { FeatureStrip } from '../components/landing/FeatureStrip';
import { CodeBlock } from '../components/landing/CodeBlock';

export default async function HomePage() {
  return (
    <>
      <HeroTwoCol />
      <ArchDiagram />
      <FeatureStrip />
      <CodeBlock />
    </>
  );
}
```

- [ ] **Step 5: Verify hero renders**

```bash
npx nx serve website
```

Open `http://localhost:3000`. Expected: two-column hero — left text with Angular red glow on "Angular", LangChain + Angular badges above headline, "⚡ Copy prompt" button; right side browser frame animation cycling through chat → card → table. Move mouse toward the frame — glow should intensify. Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add apps/website/components/landing/HeroTwoCol.tsx \
        apps/website/components/landing/GenerativeUIFrame.tsx \
        apps/website/app/page.tsx \
        apps/website/app/globals.css
git commit -m "feat(website): replace hero with two-column HeroTwoCol + GenerativeUIFrame"
```

---

## Task 2: CopyPromptButton + Prompt Files + Loader

**Files:**
- Create: `apps/website/components/docs/CopyPromptButton.tsx`
- Modify: `apps/website/lib/docs.ts` (add `getPromptBySlug`)
- Create: `apps/website/content/prompts/getting-started.md`
- Create: `apps/website/content/prompts/streaming.md`
- Create: `apps/website/content/prompts/thread-persistence.md`
- Create: `apps/website/content/prompts/configuration.md`
- Create: `apps/website/content/prompts/testing.md`
- Modify: `apps/website/components/docs/MdxRenderer.tsx` (add CopyPromptButton above prose)
- Modify: `apps/website/app/docs/[[...slug]]/page.tsx` (pass prompt to renderer)

- [ ] **Step 1: Create `CopyPromptButton.tsx`**

Create `apps/website/components/docs/CopyPromptButton.tsx`:

```tsx
'use client';
import { useState } from 'react';

interface Props {
  prompt: string;
  variant?: 'hero' | 'docs';
}

export function CopyPromptButton({ prompt, variant = 'docs' }: Props) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHero = variant === 'hero';

  return (
    <button
      onClick={handleClick}
      style={{
        background: isHero ? '#6C8EFF' : 'transparent',
        border: isHero ? 'none' : '1px solid rgba(108,142,255,0.4)',
        color: isHero ? '#fff' : '#6C8EFF',
        fontFamily: 'var(--font-mono)',
        fontSize: isHero ? 13 : 12,
        padding: isHero ? '12px 24px' : '8px 16px',
        borderRadius: isHero ? 8 : 6,
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = isHero
          ? '0 0 16px rgba(108,142,255,0.4)'
          : '0 0 10px rgba(108,142,255,0.25)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}>
      {copied ? '✓ Copied!' : '⚡ Copy prompt'}
    </button>
  );
}
```

- [ ] **Step 2: Add `getPromptBySlug` to `lib/docs.ts`**

Add to `apps/website/lib/docs.ts`:

```typescript
const PROMPTS_DIR = path.join(process.cwd(), 'content/prompts');

export function getPromptBySlug(slug: string[]): string | null {
  const filePath = path.join(PROMPTS_DIR, `${slug.join('/')}.md`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8').trim();
}
```

- [ ] **Step 3: Create prompt files**

Create `apps/website/content/prompts/getting-started.md`:

```
Add stream-resource to my Angular 20+ application.

Install: npm install stream-resource

1. In app.config.ts, add provideStreamResource({ apiUrl: 'http://localhost:2024' }) to the providers array. Import it from 'stream-resource'.

2. Create a ChatComponent that calls streamResource<{ messages: BaseMessage[] }>({ assistantId: 'chat_agent' }) in the constructor or as a field initializer. streamResource() MUST be called inside an Angular injection context — constructor or field initializer is correct; ngOnInit is not.

3. The component template should loop over chat.messages() using @for and render each message's content. Add an input field and a button that calls chat.submit({ messages: [{ role: 'human', content: inputValue }] }).

4. In app.config.ts provideStreamResource call, the apiUrl should point to the LangGraph server. For local dev this is http://localhost:2024. For production use the LangGraph Platform URL from environment.ts.

The library is framework-integrated: no subscriptions, no async pipe needed — chat.messages() is an Angular Signal that updates token by token as the LLM responds.
```

Create `apps/website/content/prompts/streaming.md`:

```
Configure token-by-token streaming in my Angular component that uses stream-resource.

The component already has streamResource() set up. Now:

1. In the template, bind to chat.messages() with @for — each BaseMessage has a .content property. The template re-renders automatically as tokens arrive because messages() is a Signal.

2. Show a loading indicator while streaming: use chat.isLoading() in an @if block.

3. To throttle rapid re-renders (if performance is a concern), pass throttle: 50 to streamResource() options — this throttles Signal updates to at most one per 50ms while preserving the final value.

4. To show the stream status more precisely, bind to chat.status() which returns 'idle' | 'loading' | 'resolved' | 'error'.

Do not use async pipe or subscribe() — the signals update automatically.
```

Create `apps/website/content/prompts/thread-persistence.md`:

```
Add thread persistence to my Angular component that uses stream-resource, so conversations survive page refresh.

1. On component init, read the stored thread ID: const storedId = localStorage.getItem('chat-thread-id').

2. Create a signal: threadId = signal<string | null>(storedId).

3. Pass it to streamResource: streamResource({ ..., threadId: this.threadId, onThreadId: (id) => { this.threadId.set(id); localStorage.setItem('chat-thread-id', id); } }).

4. The onThreadId callback fires once when the server creates a new thread. After that, the same thread ID is reused and the full conversation history is restored from the LangGraph server.

5. To start a new conversation, call this.threadId.set(null) — this causes streamResource to create a fresh thread on the next submit.

No changes to the template are needed.
```

Create `apps/website/content/prompts/configuration.md`:

```
Configure stream-resource globally and per-component in my Angular application.

Global config (applies to all streamResource() calls in the app):
In app.config.ts, provideStreamResource({ apiUrl: 'https://my-langgraph-server.com', }) — import provideStreamResource from 'stream-resource'.

Per-call override (overrides global config for one component):
Pass apiUrl directly to streamResource({ apiUrl: 'https://other-server.com', assistantId: 'my-agent' }) — per-call options take precedence over global config.

Custom transport (for auth headers, logging, or testing):
Implement StreamResourceTransport interface — it has one method: stream(input, options). Pass it as transport: myTransport to either provideStreamResource or streamResource(). FetchStreamTransport is the default.

To pass a system prompt to the LangGraph agent per-thread, use the config option:
streamResource({ config: { configurable: { system_prompt: 'You are a helpful assistant.' } } })
```

Create `apps/website/content/prompts/testing.md`:

```
Write unit tests for my Angular component that uses stream-resource, without hitting a real LangGraph server.

Use MockStreamTransport from 'stream-resource'. It implements StreamResourceTransport and lets you script exactly what events the stream emits.

Test setup:
const transport = new MockStreamTransport();
const chat = streamResource({ transport, assistantId: 'test', apiUrl: '' });

To emit a streaming response:
transport.emit([
  { type: 'values', values: { messages: [] } },
  { type: 'messages', messages: [[{ type: 'ai', content: 'Hello' }, { id: '1' }]] },
]);

Assertions after emit:
expect(chat.messages()).toHaveLength(1);
expect(chat.messages()[0].content).toBe('Hello');

To test error state:
transport.emitError(new Error('Network failure'));
expect(chat.status()).toBe('error');
expect(chat.error()).toBeInstanceOf(Error);

Never mock streamResource() itself — always use MockStreamTransport and test through the real function.
```

- [ ] **Step 4: Update `MdxRenderer.tsx` to accept and render `CopyPromptButton`**

Modify `apps/website/components/docs/MdxRenderer.tsx`:

```tsx
import { MDXRemote } from 'next-mdx-remote/rsc';
import { CopyPromptButton } from './CopyPromptButton';

interface Props {
  source: string;
  prompt?: string;
}

export function MdxRenderer({ source, prompt }: Props) {
  return (
    <article className="prose prose-invert max-w-none py-8 px-8 flex-1"
      style={{ '--tw-prose-body': 'var(--color-text-secondary)', '--tw-prose-headings': 'var(--color-text-primary)', '--tw-prose-code': 'var(--color-accent)' } as React.CSSProperties}>
      {prompt && (
        <div style={{ marginBottom: 24 }}>
          <CopyPromptButton prompt={prompt} variant="docs" />
        </div>
      )}
      <MDXRemote source={source} />
    </article>
  );
}
```

- [ ] **Step 5: Update `app/docs/[[...slug]]/page.tsx` to pass prompt**

Modify `apps/website/app/docs/[[...slug]]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { DocsSidebar } from '../../../components/docs/DocsSidebar';
import { MdxRenderer } from '../../../components/docs/MdxRenderer';
import { getDocBySlug, getAllDocSlugs, getPromptBySlug } from '../../../lib/docs';

export function generateStaticParams() {
  return getAllDocSlugs().map((slug) => ({ slug }));
}

export default async function DocsPage({ params }: { params: { slug?: string[] } }) {
  const slug = params.slug ?? ['introduction'];
  const doc = getDocBySlug(slug);
  if (!doc) notFound();
  const prompt = getPromptBySlug(slug) ?? undefined;

  return (
    <div className="flex min-h-screen pt-16">
      <DocsSidebar activeSlug={slug.join('/')} />
      <MdxRenderer source={doc.content} prompt={prompt} />
    </div>
  );
}
```

- [ ] **Step 6: Verify prompt button appears on docs pages**

```bash
npx nx serve website
```

Open `http://localhost:3000/docs/getting-started`. Expected: "⚡ Copy prompt" button appears below the `h1`, before the prose. Click it — clipboard should contain the getting-started prompt text. Stop with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add apps/website/components/docs/CopyPromptButton.tsx \
        apps/website/lib/docs.ts \
        apps/website/content/prompts/ \
        apps/website/components/docs/MdxRenderer.tsx \
        apps/website/app/docs/
git commit -m "feat(website): add CopyPromptButton, prompt files, and getPromptBySlug loader"
```

---

## Task 3: `/llms.txt` and `/llms-full.txt` Routes

**Files:**
- Create: `apps/website/app/llms.txt/route.ts`
- Create: `apps/website/app/llms-full.txt/route.ts`
- Modify: `apps/website/scripts/generate-api-docs.ts` (ensure `api-docs.json` is in `public/`)

- [ ] **Step 1: Create `app/llms.txt/route.ts`**

Create `apps/website/app/llms.txt/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import pkg from '../../../package.json';

function buildLlmsTxt(): string {
  return `# Angular Stream Resource v${pkg.version}

Angular streaming library for LangChain/LangGraph. Provides streamResource() — full parity with React's useStream() hook, built on Angular Signals.

## Install
npm install stream-resource

## Key API
- streamResource(options): StreamResourceRef — call in Angular injection context (constructor or field initializer)
- provideStreamResource(config): Provider — register in app.config.ts for global defaults
- StreamResourceRef.messages(): Signal<BaseMessage[]> — updates token by token
- StreamResourceRef.submit(values): Promise<void> — send a message / trigger a run
- StreamResourceRef.status(): Signal<'idle'|'loading'|'resolved'|'error'>
- StreamResourceRef.threadId signal + onThreadId callback — thread persistence across refreshes
- MockStreamTransport — deterministic unit testing without a real server

## Minimal example
import { streamResource } from 'stream-resource';
const chat = streamResource({ assistantId: 'chat_agent', apiUrl: 'http://localhost:2024' });
// Template: @for (msg of chat.messages(); track $index) { <p>{{ msg.content }}</p> }
// Submit: chat.submit({ messages: [{ role: 'human', content: input }] })

## MCP server
npx @stream-resource/mcp

## Full reference
https://stream-resource.dev/llms-full.txt
`.trim();
}

export async function GET() {
  return new NextResponse(buildLlmsTxt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
```

- [ ] **Step 2: Create `app/llms-full.txt/route.ts`**

Create `apps/website/app/llms-full.txt/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function loadApiDocs(): string {
  const p = path.join(process.cwd(), 'public/api-docs.json');
  if (!fs.existsSync(p)) return '(API reference not yet generated — run npm run generate-docs)';
  const json = JSON.parse(fs.readFileSync(p, 'utf8')) as { name?: string; comment?: { summary?: { text: string }[] }; children?: unknown[] };
  // Flatten to plain text: just stringify the relevant portions
  return JSON.stringify(json, null, 2);
}

function loadAllPrompts(): string {
  const dir = path.join(process.cwd(), 'content/prompts');
  if (!fs.existsSync(dir)) return '';
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const slug = f.replace(/\.md$/, '');
      const content = fs.readFileSync(path.join(dir, f), 'utf8').trim();
      return `## Prompt: ${slug}\n\n${content}`;
    })
    .join('\n\n---\n\n');
}

export async function GET() {
  const sections = [
    '# Angular Stream Resource — Full Reference\n\nSee /llms.txt for a compact summary.\n',
    '## API Reference (TypeDoc)\n\n' + loadApiDocs(),
    '## Prompt Recipes\n\n' + loadAllPrompts(),
    '## Common Gotchas\n\nstreamResource() MUST be called inside an Angular injection context.\nDo not call it in ngOnInit — use constructor or field initializer.\nDo not mock streamResource() in tests — use MockStreamTransport.\nRxJS is an internal implementation detail — do not import rxjs in consumer code.',
    '## MCP server\n\nnpx @stream-resource/mcp\nAdd to Claude Code settings.json, Cursor .cursor/mcp.json, or any MCP-compatible agent.',
  ];

  return new NextResponse(sections.join('\n\n---\n\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
```

- [ ] **Step 3: Verify routes respond**

```bash
npx nx serve website
```

Open `http://localhost:3000/llms.txt` — expected: plain text summary.
Open `http://localhost:3000/llms-full.txt` — expected: plain text full reference. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add apps/website/app/llms.txt/ apps/website/app/llms-full.txt/
git commit -m "feat(website): add /llms.txt and /llms-full.txt routes for agent discovery"
```

---

## Task 4: CLAUDE.md and AGENTS.md

**Files:**
- Create: `apps/website/scripts/generate-agent-context.ts`
- Create: `apps/website/content/CLAUDE.md.template`
- Create: `apps/website/content/AGENTS.md.template`
- Modify: root `package.json` (add generate-agent-context script)

These files are generated at build time and served as static downloads from the Getting Started doc page. Both contain identical content; only the filename differs.

- [ ] **Step 1: Create templates**

Create `apps/website/content/CLAUDE.md.template`:

```
# Angular Stream Resource v@VERSION@

Angular streaming library for LangChain/LangGraph. Provides `streamResource()` — full parity with React's `useStream()`.

## Install
npm install stream-resource

## Key requirement
`streamResource()` MUST be called within an Angular injection context (component constructor or field initializer). Calling it in ngOnInit or any async context throws "NG0203: inject() must be called from an injection context".

## Basic usage
```typescript
// app.config.ts
import { provideStreamResource } from 'stream-resource';
export const appConfig: ApplicationConfig = {
  providers: [provideStreamResource({ apiUrl: 'http://localhost:2024' })]
};

// chat.component.ts
import { streamResource } from 'stream-resource';
import type { BaseMessage } from '@langchain/core/messages';

@Component({ template: `
  @for (msg of chat.messages(); track $index) { <p>{{ msg.content }}</p> }
  <button (click)="send()">Send</button>
`})
export class ChatComponent {
  chat = streamResource<{ messages: BaseMessage[] }>({ assistantId: 'chat_agent' });
  send() { this.chat.submit({ messages: [{ role: 'human', content: 'Hello' }] }); }
}
```

## Key patterns
- Thread persistence: `threadId: signal(localStorage.getItem('t'))` + `onThreadId: (id) => localStorage.setItem('t', id)`
- Global config: `provideStreamResource({ apiUrl })` in app.config.ts
- Per-call override: pass `apiUrl` directly to `streamResource()`
- Testing: use `MockStreamTransport` — never mock `streamResource()` itself

## MCP server (for tool access)
Add to ~/.claude/settings.json:
{"mcpServers":{"stream-resource":{"command":"npx","args":["@stream-resource/mcp"]}}}

## Version check
If this file is stale, fetch the latest: https://stream-resource.dev/llms-full.txt
```

Create `apps/website/content/AGENTS.md.template` with identical content (same file, different name).

- [ ] **Step 2: Create `scripts/generate-agent-context.ts`**

Create `apps/website/scripts/generate-agent-context.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import pkg from '../../../package.json';

const VERSION = pkg.version;
const CONTENT_DIR = path.join('apps/website/content');
const PUBLIC_DIR = path.join('apps/website/public');

function generate(templateFile: string, outFile: string) {
  const template = fs.readFileSync(path.join(CONTENT_DIR, templateFile), 'utf8');
  const output = template.replace(/@VERSION@/g, VERSION);
  fs.writeFileSync(path.join(PUBLIC_DIR, outFile), output);
  console.log(`✓ ${outFile} (v${VERSION})`);
}

fs.mkdirSync(PUBLIC_DIR, { recursive: true });
generate('CLAUDE.md.template', 'CLAUDE.md');
generate('AGENTS.md.template', 'AGENTS.md');
```

- [ ] **Step 3: Add script to root `package.json`**

Add to `scripts` in the monorepo root `package.json`:

```json
"generate-agent-context": "npx tsx apps/website/scripts/generate-agent-context.ts"
```

- [ ] **Step 4: Run and verify**

```bash
npm run generate-agent-context
```

Expected: `✓ CLAUDE.md (v...)` and `✓ AGENTS.md (v...)` printed. Files appear in `apps/website/public/`.

- [ ] **Step 5: Commit**

```bash
git add apps/website/content/CLAUDE.md.template \
        apps/website/content/AGENTS.md.template \
        apps/website/scripts/generate-agent-context.ts \
        package.json \
        apps/website/public/CLAUDE.md \
        apps/website/public/AGENTS.md
git commit -m "feat(website): add CLAUDE.md and AGENTS.md generation for agent context"
```

---

## Task 5: MCP Server Package Scaffold

**Files:**
- Create: `packages/mcp/package.json`
- Create: `packages/mcp/project.json`
- Create: `packages/mcp/tsconfig.json`
- Create: `packages/mcp/src/data/loader.ts`
- Create: `packages/mcp/src/index.ts` (entry point, registers all tools)

- [ ] **Step 1: Create `packages/mcp/package.json`**

Create `packages/mcp/package.json`:

```json
{
  "name": "@stream-resource/mcp",
  "version": "0.1.0",
  "description": "MCP server for the stream-resource Angular library",
  "main": "dist/index.js",
  "bin": { "@stream-resource/mcp": "dist/index.js" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Install MCP SDK**

```bash
npm install @modelcontextprotocol/sdk
```

- [ ] **Step 3: Create `packages/mcp/tsconfig.json`**

Create `packages/mcp/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "CommonJS",
    "moduleResolution": "node",
    "emitDeclarationOnly": false,
    "composite": false,
    "declaration": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: Create `packages/mcp/project.json`**

Create `packages/mcp/project.json`:

```json
{
  "name": "mcp",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "packages/mcp/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{workspaceRoot}/dist/packages/mcp"],
      "options": {
        "outputPath": "dist/packages/mcp",
        "main": "packages/mcp/src/index.ts",
        "tsConfig": "packages/mcp/tsconfig.json"
      }
    }
  }
}
```

- [ ] **Step 5: Create `src/data/loader.ts`**

Create `packages/mcp/src/data/loader.ts`:

```typescript
import fs from 'fs';
import path from 'path';

export interface ApiDocsJson {
  children?: ApiSymbol[];
}

export interface ApiSymbol {
  name: string;
  kindString?: string;
  comment?: { summary?: { text: string }[] };
  signatures?: { parameters?: { name: string; type: { name?: string }; comment?: { summary?: { text: string }[] } }[] }[];
}

let cachedDocs: ApiDocsJson | null = null;

export function getApiDocs(): ApiDocsJson {
  if (cachedDocs) return cachedDocs;
  // Look for api-docs.json relative to the package root or CWD
  const candidates = [
    path.join(__dirname, '../../apps/website/public/api-docs.json'),
    path.join(process.cwd(), 'apps/website/public/api-docs.json'),
    path.join(process.cwd(), 'api-docs.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      cachedDocs = JSON.parse(fs.readFileSync(p, 'utf8')) as ApiDocsJson;
      return cachedDocs;
    }
  }
  return { children: [] };
}

export function findSymbol(name: string): ApiSymbol | undefined {
  const docs = getApiDocs();
  return docs.children?.find((c) => c.name === name);
}

export function getAllSymbolNames(): string[] {
  return getApiDocs().children?.map((c) => c.name) ?? [];
}
```

- [ ] **Step 6: Create `src/index.ts`**

Create `packages/mcp/src/index.ts`:

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getApiReferenceTool, handleGetApiReference } from './tools/get-api-reference.js';
import { searchDocsTool, handleSearchDocs } from './tools/search-docs.js';
import { getExampleTool, handleGetExample } from './tools/get-example.js';
import { scaffoldChatComponentTool, handleScaffoldChatComponent } from './tools/scaffold-chat-component.js';
import { addStreamResourceTool, handleAddStreamResource } from './tools/add-stream-resource.js';
import { getThreadPersistencePatternTool, handleGetThreadPersistencePattern } from './tools/get-thread-persistence-pattern.js';

const server = new Server(
  { name: 'stream-resource', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  getApiReferenceTool,
  searchDocsTool,
  getExampleTool,
  scaffoldChatComponentTool,
  addStreamResourceTool,
  getThreadPersistencePatternTool,
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const a = args as Record<string, unknown>;
  switch (name) {
    case 'get_api_reference':        return handleGetApiReference(a);
    case 'search_docs':              return handleSearchDocs(a);
    case 'get_example':              return handleGetExample(a);
    case 'scaffold_chat_component':  return handleScaffoldChatComponent(a);
    case 'add_stream_resource':      return handleAddStreamResource(a);
    case 'get_thread_persistence_pattern': return handleGetThreadPersistencePattern(a);
    default: return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
  }
});

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
```

- [ ] **Step 7: Verify Nx recognises the project**

```bash
npx nx show project mcp
```

Expected: project details printed.

- [ ] **Step 8: Commit scaffold**

```bash
git add packages/mcp/
git commit -m "feat(mcp): scaffold @stream-resource/mcp package"
```

---

## Task 6: MCP Tools Implementation

**Files:**
- Create: `packages/mcp/src/tools/get-api-reference.ts`
- Create: `packages/mcp/src/tools/search-docs.ts`
- Create: `packages/mcp/src/tools/get-example.ts`
- Create: `packages/mcp/src/tools/scaffold-chat-component.ts`
- Create: `packages/mcp/src/tools/add-stream-resource.ts`
- Create: `packages/mcp/src/tools/get-thread-persistence-pattern.ts`

- [ ] **Step 1: Create `get-api-reference.ts`**

Create `packages/mcp/src/tools/get-api-reference.ts`:

```typescript
import { findSymbol, getAllSymbolNames } from '../data/loader.js';

export const getApiReferenceTool = {
  name: 'get_api_reference',
  description: 'Get the full API documentation for a stream-resource symbol',
  inputSchema: {
    type: 'object',
    properties: { symbol: { type: 'string', description: 'Symbol name, e.g. "streamResource"' } },
    required: ['symbol'],
  },
};

export function handleGetApiReference(args: Record<string, unknown>) {
  const symbol = args['symbol'] as string;
  const entry = findSymbol(symbol);
  if (!entry) {
    return { content: [{ type: 'text', text: `Symbol not found: "${symbol}". Available: ${getAllSymbolNames().join(', ')}` }] };
  }
  const summary = entry.comment?.summary?.map((s) => s.text).join('') ?? '';
  const params = entry.signatures?.[0]?.parameters?.map((p) => {
    const pSummary = p.comment?.summary?.map((s) => s.text).join('') ?? '';
    return `  ${p.name}: ${p.type?.name ?? 'unknown'} — ${pSummary}`;
  }).join('\n') ?? '';
  const text = [`## ${entry.name}`, `Kind: ${entry.kindString ?? 'unknown'}`, summary, params ? `Parameters:\n${params}` : ''].filter(Boolean).join('\n\n');
  return { content: [{ type: 'text', text }] };
}
```

- [ ] **Step 2: Create `search-docs.ts`**

Create `packages/mcp/src/tools/search-docs.ts`:

```typescript
import { getApiDocs } from '../data/loader.js';

export const searchDocsTool = {
  name: 'search_docs',
  description: 'Search stream-resource documentation by keyword or phrase',
  inputSchema: {
    type: 'object',
    properties: { query: { type: 'string', description: 'Search query' } },
    required: ['query'],
  },
};

export function handleSearchDocs(args: Record<string, unknown>) {
  const query = (args['query'] as string).toLowerCase();
  const docs = getApiDocs();
  const matches: string[] = [];
  for (const child of docs.children ?? []) {
    const text = [
      child.name,
      child.comment?.summary?.map((s) => s.text).join('') ?? '',
      ...(child.signatures?.[0]?.parameters?.map((p) => `${p.name}: ${p.comment?.summary?.map((s) => s.text).join('') ?? ''}`) ?? []),
    ].join(' ').toLowerCase();
    if (text.includes(query)) {
      const summary = child.comment?.summary?.map((s) => s.text).join('') ?? '';
      matches.push(`## ${child.name}\n${summary}`);
    }
    if (matches.length >= 5) break;
  }
  if (matches.length === 0) {
    return { content: [{ type: 'text', text: `No results for: "${args['query']}"` }] };
  }
  return { content: [{ type: 'text', text: matches.join('\n\n---\n\n') }] };
}
```

- [ ] **Step 3: Create `get-example.ts`**

Create `packages/mcp/src/tools/get-example.ts`:

```typescript
const EXAMPLES: Record<string, string> = {
  'basic-chat': `// Basic chat component with stream-resource
import { Component } from '@angular/core';
import { streamResource } from 'stream-resource';
import type { BaseMessage } from '@langchain/core/messages';

@Component({
  selector: 'app-chat',
  template: \`
    @for (msg of chat.messages(); track $index) {
      <p [class.ai]="msg.getType() === 'ai'">{{ msg.content }}</p>
    }
    @if (chat.isLoading()) { <p>Thinking…</p> }
    <input #input type="text" />
    <button (click)="send(input.value); input.value = ''">Send</button>
  \`,
})
export class ChatComponent {
  chat = streamResource<{ messages: BaseMessage[] }>({
    assistantId: 'chat_agent',
  });
  send(content: string) {
    if (!content.trim()) return;
    this.chat.submit({ messages: [{ role: 'human', content }] } as any);
  }
}`,

  'thread-persistence': `// Thread persistence with localStorage
import { Component, signal } from '@angular/core';
import { streamResource } from 'stream-resource';
import type { BaseMessage } from '@langchain/core/messages';

@Component({ selector: 'app-chat', template: \`
  @for (msg of chat.messages(); track $index) { <p>{{ msg.content }}</p> }
  <button (click)="send()">Send</button>
  <button (click)="newThread()">New conversation</button>
\` })
export class ChatComponent {
  threadId = signal<string | null>(localStorage.getItem('chat-thread'));

  chat = streamResource<{ messages: BaseMessage[] }>({
    assistantId: 'chat_agent',
    threadId: this.threadId,
    onThreadId: (id) => {
      this.threadId.set(id);
      localStorage.setItem('chat-thread', id);
    },
  });

  send() { this.chat.submit({ messages: [{ role: 'human', content: 'Hello' }] } as any); }
  newThread() { this.threadId.set(null); localStorage.removeItem('chat-thread'); }
}`,

  'system-prompt': `// System prompt configuration per session
import { Component } from '@angular/core';
import { streamResource } from 'stream-resource';

@Component({ selector: 'app-chat', template: '' })
export class ChatComponent {
  chat = streamResource({
    assistantId: 'chat_agent',
    config: {
      configurable: {
        system_prompt: 'You are a helpful coding assistant specialised in Angular.',
      },
    },
  });
}`,

  'mock-testing': `// Unit testing with MockStreamTransport
import { TestBed } from '@angular/core/testing';
import { streamResource, MockStreamTransport } from 'stream-resource';
import type { BaseMessage } from '@langchain/core/messages';

describe('ChatComponent', () => {
  it('updates messages signal when transport emits', () => {
    TestBed.runInInjectionContext(() => {
      const transport = new MockStreamTransport();
      const chat = streamResource<{ messages: BaseMessage[] }>({
        assistantId: 'test', transport,
      });
      transport.emit([
        { type: 'messages', messages: [[{ type: 'ai', content: 'Hello!' }, { id: '1' }]] },
      ]);
      expect(chat.messages()).toHaveLength(1);
      expect(chat.messages()[0].content).toBe('Hello!');
    });
  });
});`,

  'interrupts': `// Handling interrupts (human-in-the-loop)
import { Component } from '@angular/core';
import { streamResource } from 'stream-resource';

@Component({
  selector: 'app-chat',
  template: \`
    @if (chat.interrupt(); as interrupt) {
      <div class="interrupt">
        <p>{{ interrupt.value }}</p>
        <button (click)="approve()">Approve</button>
        <button (click)="reject()">Reject</button>
      </div>
    }
  \`,
})
export class ChatComponent {
  chat = streamResource({ assistantId: 'agent_with_interrupts' });
  approve() { this.chat.submit(null, { command: { resume: true } }); }
  reject()  { this.chat.submit(null, { command: { resume: false } }); }
}`,

  'subagent-progress': `// Showing subagent tool call progress
import { Component } from '@angular/core';
import { streamResource } from 'stream-resource';

@Component({
  selector: 'app-chat',
  template: \`
    @for (tool of chat.toolProgress(); track tool.name) {
      <p>{{ tool.name }}: {{ tool.status }}</p>
    }
  \`,
})
export class ChatComponent {
  chat = streamResource({ assistantId: 'research_agent' });
}`,

  'custom-transport': `// Custom transport with auth headers
import { StreamResourceTransport } from 'stream-resource';

export class AuthTransport implements StreamResourceTransport {
  async *stream(input: unknown, options: unknown): AsyncGenerator<unknown> {
    const token = await getAuthToken(); // your auth logic
    const res = await fetch('/api/stream', {
      method: 'POST',
      headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    // parse SSE from res.body
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\\n');
      buffer = lines.pop()!;
      for (const line of lines) {
        if (line.startsWith('data: ')) yield JSON.parse(line.slice(6));
      }
    }
  }
}`,
};

const VALID_PATTERNS = Object.keys(EXAMPLES);

export const getExampleTool = {
  name: 'get_example',
  description: 'Get a complete runnable code example for a stream-resource pattern',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: `Pattern name. One of: ${VALID_PATTERNS.join(', ')}`,
      },
    },
    required: ['pattern'],
  },
};

export function handleGetExample(args: Record<string, unknown>) {
  const pattern = args['pattern'] as string;
  const example = EXAMPLES[pattern];
  if (!example) {
    return { content: [{ type: 'text', text: `Unknown pattern: "${pattern}". Available: ${VALID_PATTERNS.join(', ')}` }] };
  }
  return { content: [{ type: 'text', text: `\`\`\`typescript\n${example}\n\`\`\`` }] };
}
```

- [ ] **Step 4: Create `scaffold-chat-component.ts`**

Create `packages/mcp/src/tools/scaffold-chat-component.ts`:

```typescript
export const scaffoldChatComponentTool = {
  name: 'scaffold_chat_component',
  description: 'Generate a complete Angular chat component using stream-resource',
  inputSchema: {
    type: 'object',
    properties: {
      componentName: { type: 'string', description: 'Component class name, e.g. "ChatComponent"' },
      apiUrl: { type: 'string', description: 'LangGraph server URL, e.g. "http://localhost:2024"' },
      assistantId: { type: 'string', description: 'LangGraph assistant/graph ID' },
      threadPersistence: { type: 'boolean', description: 'Include localStorage thread persistence' },
    },
    required: ['componentName', 'apiUrl', 'assistantId', 'threadPersistence'],
  },
};

export function handleScaffoldChatComponent(args: Record<string, unknown>) {
  const { componentName, apiUrl, assistantId, threadPersistence } = args as {
    componentName: string; apiUrl: string; assistantId: string; threadPersistence: boolean;
  };

  const selector = componentName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');

  const persistenceImport = threadPersistence ? ", signal" : "";
  const persistenceFields = threadPersistence ? `
  threadId = signal<string | null>(localStorage.getItem('${selector}-thread'));` : "";
  const persistenceOptions = threadPersistence ? `
    threadId: this.threadId,
    onThreadId: (id: string) => {
      this.threadId.set(id);
      localStorage.setItem('${selector}-thread', id);
    },` : "";

  const code = `import { Component${persistenceImport} } from '@angular/core';
import { streamResource } from 'stream-resource';
import type { BaseMessage } from '@langchain/core/messages';

@Component({
  selector: 'app-${selector}',
  template: \`
    <div class="messages">
      @for (msg of chat.messages(); track $index) {
        <div class="message" [class.ai]="msg.getType() === 'ai'">
          {{ msg.content }}
        </div>
      }
      @if (chat.isLoading()) {
        <div class="loading">Thinking…</div>
      }
    </div>
    <form (submit)="send($event)">
      <input #input type="text" placeholder="Type a message…" />
      <button type="submit">Send</button>
    </form>
  \`,
})
export class ${componentName} {${persistenceFields}

  chat = streamResource<{ messages: BaseMessage[] }>({
    apiUrl: '${apiUrl}',
    assistantId: '${assistantId}',${persistenceOptions}
  });

  send(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.querySelector('input') as HTMLInputElement;
    const content = input.value.trim();
    if (!content) return;
    input.value = '';
    this.chat.submit({ messages: [{ role: 'human', content }] } as any);
  }
}`;

  return { content: [{ type: 'text', text: `\`\`\`typescript\n${code}\n\`\`\`` }] };
}
```

- [ ] **Step 5: Create `add-stream-resource.ts`**

Create `packages/mcp/src/tools/add-stream-resource.ts`:

```typescript
import fs from 'fs';

export const addStreamResourceTool = {
  name: 'add_stream_resource',
  description: 'Generate npm install command and app.config.ts diff to add stream-resource to an Angular project',
  inputSchema: {
    type: 'object',
    properties: {
      appConfigPath: { type: 'string', description: 'Path to app.config.ts, e.g. "src/app/app.config.ts"' },
    },
    required: ['appConfigPath'],
  },
};

export function handleAddStreamResource(args: Record<string, unknown>) {
  const appConfigPath = args['appConfigPath'] as string;

  if (!fs.existsSync(appConfigPath)) {
    return { content: [{ type: 'text', text: `File not found or is not an Angular app.config.ts: ${appConfigPath}` }] };
  }
  const content = fs.readFileSync(appConfigPath, 'utf8');
  if (!content.includes('ApplicationConfig') && !content.includes('appConfig')) {
    return { content: [{ type: 'text', text: `File does not appear to be an Angular app.config.ts (no ApplicationConfig found): ${appConfigPath}` }] };
  }

  const diff = `Steps to add stream-resource:

1. Install the package:
\`\`\`bash
npm install stream-resource
\`\`\`

2. Apply this change to ${appConfigPath}:
\`\`\`diff
+import { provideStreamResource } from 'stream-resource';

 export const appConfig: ApplicationConfig = {
   providers: [
+    provideStreamResource({ apiUrl: 'REPLACE_WITH_YOUR_LANGGRAPH_URL' }),
     // ... existing providers
   ]
 };
\`\`\`

Replace REPLACE_WITH_YOUR_LANGGRAPH_URL with your LangGraph server URL (e.g. http://localhost:2024 for local dev).`;

  return { content: [{ type: 'text', text: diff }] };
}
```

- [ ] **Step 6: Create `get-thread-persistence-pattern.ts`**

Create `packages/mcp/src/tools/get-thread-persistence-pattern.ts`:

```typescript
const PATTERNS = {
  localStorage: `// Thread persistence with localStorage
threadId = signal<string | null>(localStorage.getItem('chat-thread-id'));

chat = streamResource({
  assistantId: 'chat_agent',
  threadId: this.threadId,
  onThreadId: (id: string) => {
    this.threadId.set(id);
    localStorage.setItem('chat-thread-id', id);
  },
});

// To start a new conversation:
// this.threadId.set(null); localStorage.removeItem('chat-thread-id');`,

  sessionStorage: `// Thread persistence with sessionStorage (clears on tab close)
threadId = signal<string | null>(sessionStorage.getItem('chat-thread-id'));

chat = streamResource({
  assistantId: 'chat_agent',
  threadId: this.threadId,
  onThreadId: (id: string) => {
    this.threadId.set(id);
    sessionStorage.setItem('chat-thread-id', id);
  },
});`,

  custom: `// Thread persistence with a custom store
// TODO: replace saveThread / loadThread with your store (e.g. NgRx, a service, IndexedDB)
threadId = signal<string | null>(loadThread());

chat = streamResource({
  assistantId: 'chat_agent',
  threadId: this.threadId,
  onThreadId: (id: string) => {
    this.threadId.set(id);
    saveThread(id); // TODO: replace with your store
  },
});`,
};

export const getThreadPersistencePatternTool = {
  name: 'get_thread_persistence_pattern',
  description: 'Get the Angular code pattern for thread persistence with a specific storage type',
  inputSchema: {
    type: 'object',
    properties: {
      storageType: {
        type: 'string',
        enum: ['localStorage', 'sessionStorage', 'custom'],
        description: 'Storage mechanism to use for thread ID persistence',
      },
    },
    required: ['storageType'],
  },
};

export function handleGetThreadPersistencePattern(args: Record<string, unknown>) {
  const storageType = args['storageType'] as keyof typeof PATTERNS;
  const pattern = PATTERNS[storageType];
  if (!pattern) {
    return { content: [{ type: 'text', text: `Unknown storageType: "${storageType}". Use: localStorage, sessionStorage, or custom` }] };
  }
  return { content: [{ type: 'text', text: `\`\`\`typescript\n${pattern}\n\`\`\`` }] };
}
```

- [ ] **Step 7: Build the MCP package**

```bash
npx nx build mcp
```

Expected: `dist/packages/mcp/` created, `index.js` present.

- [ ] **Step 8: Smoke test the server**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/packages/mcp/index.js
```

Expected: JSON response listing all 6 tools.

- [ ] **Step 9: Commit**

```bash
git add packages/mcp/src/tools/ packages/mcp/src/index.ts package-lock.json
git commit -m "feat(mcp): implement all six MCP tools for stream-resource"
```

---

## Final Verification

- [ ] **Run Angular unit tests (unchanged)**

```bash
npx nx test stream-resource
```

Expected: all tests pass.

- [ ] **Verify /llms.txt and /llms-full.txt**

```bash
npx nx serve website
curl http://localhost:3000/llms.txt | head -20
curl http://localhost:3000/llms-full.txt | wc -l
```

Expected: llms.txt shows compact summary; llms-full.txt is substantial.

- [ ] **Verify MCP server lists tools**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/packages/mcp/index.js | npx -y jq '.result.tools[].name'
```

Expected: 6 tool names printed.

- [ ] **Verify copy prompt button on docs page**

```bash
npx nx serve website
```

Open `http://localhost:3000/docs/getting-started`. Expected: "⚡ Copy prompt" button visible above prose.
