# White Paper Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-time Anthropic SDK script that generates a 6-chapter PDF white paper, plus a free-download `WhitePaperSection` component on the landing page with an optional lead-gen form.

**Architecture:** `apps/website/scripts/generate-whitepaper.ts` calls Anthropic API for 6 chapters shaped by the production-readiness assessment framework, builds a self-contained HTML document, then uses Puppeteer to render it to `apps/website/public/whitepaper.pdf`. A `WhitePaperSection` React component provides a direct download link and optional name/email form backed by a Next.js API route that appends to a local NDJSON file.

**Tech Stack:** `@anthropic-ai/sdk` (already in devDependencies at `^0.79.0`), `puppeteer` (add as devDependency), `npx tsx` for script execution, Next.js API route for form submission

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/website/scripts/generate-whitepaper.ts` | Anthropic API calls + HTML build + Puppeteer PDF render |
| Create | `apps/website/src/components/landing/WhitePaperSection.tsx` | Download button + optional lead-gen form |
| Create | `apps/website/src/app/api/whitepaper-signup/route.ts` | POST handler, appends to NDJSON file |
| Modify | `package.json` (root) | Add `generate-whitepaper` script + `puppeteer` devDependency |
| Modify | `apps/website/src/app/page.tsx` | Insert `<WhitePaperSection />` |

---

### Task 1: Add puppeteer and generate-whitepaper script to package.json

**Files:**
- Modify: `package.json` (root, at `/Users/blove/repos/stream-resource/package.json`)

- [ ] **Step 1: Add puppeteer devDependency**

In the root `package.json`, add `"puppeteer": "^22.0.0"` to `devDependencies`.

- [ ] **Step 2: Add generate-whitepaper script**

In the root `package.json` `scripts` section, add:

```json
"generate-whitepaper": "npx tsx apps/website/scripts/generate-whitepaper.ts"
```

The scripts section should look like:

```json
"scripts": {
  "generate-agent-context": "npx tsx --tsconfig apps/website/tsconfig.json apps/website/scripts/generate-agent-context.ts",
  "generate-api-docs": "npx tsx apps/website/scripts/generate-api-docs.ts",
  "generate-narrative-docs": "npx tsx apps/website/scripts/generate-narrative-docs.ts",
  "generate-docs": "npm run generate-api-docs && npm run generate-narrative-docs",
  "generate-whitepaper": "npx tsx apps/website/scripts/generate-whitepaper.ts"
}
```

- [ ] **Step 3: Install puppeteer**

```bash
cd /Users/blove/repos/stream-resource && npm install
```

Expected: `node_modules/puppeteer` directory appears, no install errors

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add puppeteer devDependency and generate-whitepaper script"
```

---

### Task 2: Create the generate-whitepaper.ts script

**Files:**
- Create: `apps/website/scripts/generate-whitepaper.ts`

- [ ] **Step 1: Create the script**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const client = new Anthropic();
const MODEL = process.env['ANTHROPIC_MODEL'] ?? 'claude-opus-4-5';
const OUTPUT_PDF = 'apps/website/public/whitepaper.pdf';
const OUTPUT_HTML = 'apps/website/public/whitepaper-preview.html';

// ── Chapter definitions ──────────────────────────────────────────────────
const CHAPTERS = [
  {
    id: 'streaming-state',
    title: 'Streaming State Management',
    prompt: `Write a 400-600 word chapter for an engineering white paper titled "From Prototype to Production: The Angular Agent Readiness Guide".

Chapter topic: Streaming State Management

Context: Angular teams building LangGraph-powered agents must wire SSE event streams into reactive UI. Without the right primitives, they end up with custom zone-patching, manual subscription management, and brittle token accumulation logic that breaks under load.

Cover:
- Why streaming state is hard in Angular (zone.js, change detection, timing)
- The signals-native approach: how streamResource() exposes messages() as Signal<AIMessage[]>
- How isStreaming() lets developers drive loading UI without polling
- Code example: minimal streamResource() setup (TypeScript snippet, 8-12 lines)
- Production checklist item: "Are your message signals OnPush-compatible?"

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
  },
  {
    id: 'thread-persistence',
    title: 'Thread Persistence',
    prompt: `Write a 400-600 word chapter for an engineering white paper titled "From Prototype to Production: The Angular Agent Readiness Guide".

Chapter topic: Thread Persistence

Context: Demos work with ephemeral state. Production agents need conversation history that survives page refreshes, tab switches, and navigation — wired to LangGraph's MemorySaver backend.

Cover:
- Why stateless agent UIs fail in production
- The threadId signal and onThreadId callback pattern
- How to persist threadId to localStorage and restore on mount
- Thread list UI and switching between conversations
- Code example: provideStreamResource() with threadId (8-12 lines)
- Production checklist item: "Does your agent UI resume threads correctly after a browser refresh?"

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
  },
  {
    id: 'tool-call-rendering',
    title: 'Tool-Call Rendering',
    prompt: `Write a 400-600 word chapter for an engineering white paper titled "From Prototype to Production: The Angular Agent Readiness Guide".

Chapter topic: Tool-Call Rendering

Context: LangGraph agents invoke tools mid-stream. The UI needs to show tool execution state in real time — steps appearing as the tool runs, a final result, and collapsible history — without parsing raw SSE events by hand.

Cover:
- What tool call events look like in the raw stream
- Why hand-parsing is fragile and hard to test
- The <chat-tool-calls> headless primitive and <chat-tool-call-card> prebuilt option
- Progressive disclosure: showing steps live, collapsing on completion
- Code example: <chat-tool-call-card> binding (8-12 lines of Angular template)
- Production checklist item: "Do your tool call cards handle partial step state during streaming?"

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
  },
  {
    id: 'human-approval-flows',
    title: 'Human Approval Flows',
    prompt: `Write a 400-600 word chapter for an engineering white paper titled "From Prototype to Production: The Angular Agent Readiness Guide".

Chapter topic: Human Approval Flows (Interrupts)

Context: Production agents that take consequential actions — sending emails, deploying services, modifying data — must pause for human approval before proceeding. This requires a tight loop between LangGraph's interrupt() primitive and Angular UI.

Cover:
- The LangGraph interrupt() and Command.RESUME pattern
- Why polling and custom websocket approaches are brittle
- The interrupt() signal in streamResource() and how it maps to approval state
- <chat-interrupt> headless and <chat-interrupt-panel> prebuilt
- The three approval actions: approve, edit, cancel — and how each maps to a resume command
- Code example: interrupt signal binding (8-12 lines)
- Production checklist item: "Can your agent UI recover gracefully if a user cancels an interrupt?"

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
  },
  {
    id: 'generative-ui',
    title: 'Generative UI',
    prompt: `Write a 400-600 word chapter for an engineering white paper titled "From Prototype to Production: The Angular Agent Readiness Guide".

Chapter topic: Generative UI

Context: The most advanced production agents emit structured UI specs — not just text. A data analysis agent might render a live table. A booking agent might render a reservation form. Without a framework for this, teams either hardcode component logic into the agent or skip the feature entirely.

Cover:
- The onCustomEvent pattern in LangGraph: how agents emit structured data
- The @cacheplane/render approach: json-render specs, defineAngularRegistry(), <render-spec>
- How JSON patch streaming enables progressive UI updates (rows appearing as data arrives)
- The registry pattern: decoupling agent from component implementation
- Code example: defineAngularRegistry() registration (8-12 lines)
- Production checklist item: "Can your agent emit UI components without tight coupling to the frontend codebase?"

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
  },
  {
    id: 'deterministic-testing',
    title: 'Deterministic Testing',
    prompt: `Write a 400-600 word chapter for an engineering white paper titled "From Prototype to Production: The Angular Agent Readiness Guide".

Chapter topic: Deterministic Testing

Context: Agent UIs are notoriously hard to test because they depend on live LLM responses. Flaky tests, slow CI, and inability to reproduce edge cases are the main reasons agent UIs ship with low confidence.

Cover:
- Why testing agent components against real LLM APIs is impractical
- The MockStreamTransport approach: scripted event sequences, no server needed
- createMockStreamResourceRef(): writable signals you control directly in tests
- How to test streaming, interrupts, tool calls, and generative UI in isolation
- Code example: createMockStreamResourceRef() test pattern (10-14 lines)
- Production checklist item: "Do your agent component tests run offline and complete in under 100ms each?"

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
  },
];

// ── Markdown to HTML converter ───────────────────────────────────────────
function mdToHTML(md: string): string {
  return md
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[^\n]+<\/li>\n?)+/g, match => `<ul>${match}</ul>`)
    .split('\n\n')
    .map(block => {
      if (block.startsWith('<h') || block.startsWith('<ul') || block.startsWith('<pre')) return block;
      const trimmed = block.trim();
      return trimmed ? `<p>${trimmed}</p>` : '';
    })
    .join('\n');
}

// ── HTML builder ─────────────────────────────────────────────────────────
function buildHTML(chapters: Array<{ title: string; content: string }>): string {
  const tocHTML = chapters.map((ch, i) => `
    <div style="display:flex;align-items:baseline;gap:8px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.06);font-size:15px;color:#444">
      <span style="font-family:monospace;font-size:11px;color:#004090;font-weight:700;min-width:24px">${String(i + 1).padStart(2, '0')}</span>
      <span style="flex:1">${ch.title}</span>
    </div>`).join('');

  const chaptersHTML = chapters.map((ch, i) => `
    <section style="padding:80px;page-break-before:always">
      <div style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#004090;font-weight:700;margin-bottom:16px">Chapter ${i + 1}</div>
      <h2 style="font-family:'EB Garamond',serif;font-size:36px;font-weight:800;color:#1a1a2e;margin-bottom:28px;line-height:1.15">${ch.title}</h2>
      <div class="chapter-body">${mdToHTML(ch.content)}</div>
    </section>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',sans-serif;color:#1a1a2e;background:#fff}
  .chapter-body p{font-size:15px;line-height:1.75;color:#333;margin-bottom:18px}
  .chapter-body h3{font-family:'EB Garamond',serif;font-size:22px;font-weight:700;color:#1a1a2e;margin:28px 0 12px}
  .chapter-body ul{margin:0 0 18px 20px}
  .chapter-body li{font-size:15px;line-height:1.7;color:#333;margin-bottom:6px}
  .chapter-body pre{background:#1a1b26;color:#c8ccee;padding:20px 24px;border-radius:8px;font-size:13px;line-height:1.65;overflow-x:auto;margin:24px 0;white-space:pre-wrap}
  .chapter-body code{font-family:'JetBrains Mono',monospace;font-size:13px}
  .chapter-body strong{font-weight:600}
</style>
</head>
<body>

<!-- Cover -->
<div style="height:100vh;display:flex;flex-direction:column;justify-content:flex-end;padding:80px 80px 100px;background:linear-gradient(135deg,#fef0f3 0%,#f4f0ff 45%,#eaf3ff 70%,#e6f4ff 100%);page-break-after:always">
  <div style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#004090;font-weight:700;margin-bottom:24px">StreamResource · Production Readiness Guide</div>
  <h1 style="font-family:'EB Garamond',serif;font-size:52px;font-weight:800;line-height:1.1;color:#1a1a2e;margin-bottom:20px">From Prototype<br>to Production</h1>
  <p style="font-family:'EB Garamond',serif;font-style:italic;font-size:20px;color:#555770;margin-bottom:40px">The Angular Agent Readiness Guide</p>
  <div style="font-size:13px;color:#888;font-family:monospace">cacheplane.io · ${new Date().getFullYear()}</div>
</div>

<!-- TOC -->
<div style="padding:80px;page-break-after:always">
  <h2 style="font-family:'EB Garamond',serif;font-size:32px;font-weight:700;color:#1a1a2e;margin-bottom:32px">Contents</h2>
  ${tocHTML}
</div>

<!-- Chapters -->
${chaptersHTML}

</body>
</html>`;
}

// ── PDF renderer ─────────────────────────────────────────────────────────
async function renderPDF(html: string, outputPath: string): Promise<void> {
  console.log('  Launching browser for PDF render...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await browser.close();
}

// ── Chapter generator ────────────────────────────────────────────────────
async function generateChapter(chapter: typeof CHAPTERS[0]): Promise<string> {
  console.log(`  Generating: ${chapter.title}...`);
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: chapter.prompt }],
  });
  const content = message.content[0];
  if (content.type !== 'text') throw new Error(`Unexpected content type: ${content.type}`);
  return content.text;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('StreamResource White Paper Generator\n');
  console.log(`Model: ${MODEL}`);
  console.log(`Output: ${OUTPUT_PDF}\n`);

  const generatedChapters: Array<{ title: string; content: string }> = [];

  for (const chapter of CHAPTERS) {
    const content = await generateChapter(chapter);
    generatedChapters.push({ title: chapter.title, content });
  }

  console.log('\nBuilding HTML document...');
  const html = buildHTML(generatedChapters);
  fs.mkdirSync(path.dirname(OUTPUT_HTML), { recursive: true });
  fs.writeFileSync(OUTPUT_HTML, html, 'utf8');
  console.log(`  HTML preview: ${OUTPUT_HTML}`);

  console.log('Rendering PDF...');
  fs.mkdirSync(path.dirname(OUTPUT_PDF), { recursive: true });
  await renderPDF(html, OUTPUT_PDF);

  const stat = fs.statSync(OUTPUT_PDF);
  console.log(`\n✓ Done. PDF saved to ${OUTPUT_PDF} (${Math.round(stat.size / 1024)}KB)`);
  console.log(`✓ HTML preview: ${OUTPUT_HTML}`);
}

main().catch(err => {
  console.error('Generation failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Type-check the script**

```bash
cd /Users/blove/repos/stream-resource && npx tsx --tsconfig apps/website/tsconfig.json --check apps/website/scripts/generate-whitepaper.ts 2>&1 | tail -20
```

Expected: no type errors. If puppeteer types are missing, run: `npm install --save-dev @types/puppeteer` (puppeteer v22 includes its own types, so this likely isn't needed)

- [ ] **Step 3: Dry-run with a single chapter (optional smoke test)**

Temporarily edit the script to only include the first chapter (`const CHAPTERS = [CHAPTERS_FULL[0]]`), run it, then revert. This confirms the Anthropic API call and Puppeteer render work before spending credits on all 6 chapters.

```bash
ANTHROPIC_MODEL=claude-haiku-4-5 npm run generate-whitepaper
```

Expected: `apps/website/public/whitepaper.pdf` appears, file size > 50KB

- [ ] **Step 4: Run full generation**

```bash
npm run generate-whitepaper
```

Expected output:
```
StreamResource White Paper Generator

Model: claude-opus-4-5
Output: apps/website/public/whitepaper.pdf

  Generating: Streaming State Management...
  Generating: Thread Persistence...
  Generating: Tool-Call Rendering...
  Generating: Human Approval Flows...
  Generating: Generative UI...
  Generating: Deterministic Testing...

Building HTML document...
  HTML preview: apps/website/public/whitepaper-preview.html
Rendering PDF...
  Launching browser for PDF render...

✓ Done. PDF saved to apps/website/public/whitepaper.pdf (XXX KB)
✓ HTML preview: apps/website/public/whitepaper-preview.html
```

Open `apps/website/public/whitepaper-preview.html` in a browser and verify: cover page, table of contents, 6 chapters with correct titles and code examples.

- [ ] **Step 5: Commit**

```bash
git add apps/website/scripts/generate-whitepaper.ts apps/website/public/whitepaper.pdf apps/website/public/whitepaper-preview.html
git commit -m "feat: add whitepaper generation script and generated PDF"
```

---

### Task 3: Create the API route for optional lead-gen form

**Files:**
- Create: `apps/website/src/app/api/whitepaper-signup/route.ts`

- [ ] **Step 1: Create the directory and route file**

```typescript
// apps/website/src/app/api/whitepaper-signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SIGNUPS_FILE = path.join(process.cwd(), 'data', 'whitepaper-signups.ndjson');

export async function POST(req: NextRequest) {
  let body: { name?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name = '', email = '' } = body;
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  const entry = JSON.stringify({ name: name.trim(), email: email.trim(), ts: new Date().toISOString() }) + '\n';
  try {
    fs.mkdirSync(path.dirname(SIGNUPS_FILE), { recursive: true });
    fs.appendFileSync(SIGNUPS_FILE, entry, 'utf8');
  } catch (err) {
    console.error('Failed to write signup:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Add data directory to .gitignore**

Check if `/Users/blove/repos/stream-resource/.gitignore` or `apps/website/.gitignore` exists and add the signups file path. The PDF should be committed but signup data should not:

```bash
echo "apps/website/data/" >> .gitignore
```

- [ ] **Step 3: Build check**

```bash
cd apps/website && ../../node_modules/.bin/next build --no-lint 2>&1 | tail -20
```

- [ ] **Step 4: Test the route manually**

Start dev server, then in a separate terminal:

```bash
curl -X POST http://localhost:3000/api/whitepaper-signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com"}'
```

Expected response: `{"ok":true}`

Check file was created:
```bash
cat apps/website/data/whitepaper-signups.ndjson
```

Expected: `{"name":"Test User","email":"test@example.com","ts":"2026-..."}`

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/app/api/whitepaper-signup/route.ts .gitignore
git commit -m "feat: add whitepaper signup API route with NDJSON persistence"
```

---

### Task 4: Create WhitePaperSection component

**Files:**
- Create: `apps/website/src/components/landing/WhitePaperSection.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

type FormState = 'idle' | 'submitting' | 'done' | 'error';

export function WhitePaperSection() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setFormState('submitting');
    try {
      const res = await fetch('/api/whitepaper-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) throw new Error('Server error');
      setFormState('done');
    } catch {
      setFormState('error');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.7)',
    border: `1px solid ${tokens.glass.border}`,
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: '0.88rem',
    color: tokens.colors.textPrimary,
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    marginBottom: 10,
    backdropFilter: `blur(${tokens.glass.blur})`,
  };

  return (
    <section style={{ padding: '80px 32px' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{
          maxWidth: 860,
          margin: '0 auto',
          borderRadius: 20,
          background: tokens.glass.bg,
          backdropFilter: `blur(${tokens.glass.blur})`,
          WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`,
          boxShadow: tokens.glass.shadow,
          padding: '48px 56px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 56,
          alignItems: 'center',
        }}
      >
        {/* Left — download CTA */}
        <div>
          <p style={{
            fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
            fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.12em',
            fontWeight: 700, color: tokens.colors.accent, marginBottom: 14,
          }}>
            Free Download
          </p>
          <h2 style={{
            fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
            fontSize: 'clamp(22px,2.5vw,36px)', fontWeight: 800, lineHeight: 1.15,
            color: tokens.colors.textPrimary, marginBottom: 14,
          }}>
            From Prototype<br />to Production
          </h2>
          <p style={{
            fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
            fontStyle: 'italic', fontSize: '1rem', color: tokens.colors.textSecondary,
            lineHeight: 1.55, marginBottom: 28,
          }}>
            The Angular Agent Readiness Guide. Six chapters. Six production-readiness dimensions.
            What separates demos from shipped products.
          </p>
          <a
            href="/whitepaper.pdf"
            download="streamresource-angular-agent-readiness-guide.pdf"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: tokens.colors.accent, color: '#fff',
              padding: '12px 28px', borderRadius: 10,
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              textDecoration: 'none',
              boxShadow: `0 4px 16px rgba(0,64,144,.28)`,
              transition: 'box-shadow .2s, transform .2s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 6px 24px rgba(0,64,144,.4)';
              (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 16px rgba(0,64,144,.28)';
              (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
            }}
          >
            ↓ Download PDF
          </a>
        </div>

        {/* Right — optional form */}
        <div>
          <p style={{
            fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
            fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.1em',
            fontWeight: 700, color: tokens.colors.textMuted, marginBottom: 16,
          }}>
            Optional — Get notified of updates
          </p>

          {formState === 'done' ? (
            <div style={{
              padding: '20px 24px', borderRadius: 12,
              background: 'rgba(26,122,64,.07)', border: '1px solid rgba(26,122,64,.2)',
              fontSize: '0.88rem', color: '#1a7a40', lineHeight: 1.55,
            }}>
              ✓ Thanks! We'll reach out when the guide is updated.
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <input
                style={inputStyle}
                type="text"
                placeholder="Name (optional)"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={formState === 'submitting'}
              />
              <input
                style={{ ...inputStyle, marginBottom: 16 }}
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={formState === 'submitting'}
              />
              {formState === 'error' && (
                <p style={{ fontSize: '0.8rem', color: tokens.colors.angularRed, marginBottom: 10 }}>
                  Something went wrong — please try again.
                </p>
              )}
              <button
                type="submit"
                disabled={formState === 'submitting' || !email}
                style={{
                  padding: '10px 24px', borderRadius: 9,
                  background: email ? `rgba(0,64,144,.08)` : 'rgba(0,0,0,.04)',
                  border: `1px solid ${email ? `rgba(0,64,144,.22)` : 'rgba(0,0,0,.08)'}`,
                  color: email ? tokens.colors.accent : tokens.colors.textMuted,
                  fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                  fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                  cursor: email ? 'pointer' : 'not-allowed',
                  transition: 'background .2s, border-color .2s',
                }}
              >
                {formState === 'submitting' ? 'Sending…' : 'Notify me'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd apps/website && ../../node_modules/.bin/next build --no-lint 2>&1 | tail -20
```

- [ ] **Step 3: Visual verification**

Add `<WhitePaperSection />` to page.tsx temporarily. Confirm:
1. Two-column layout renders: download CTA on left, form on right
2. "↓ Download PDF" button is a real link to `/whitepaper.pdf`
3. Submitting form with valid email shows success state
4. Submitting without email shows required validation

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/WhitePaperSection.tsx
git commit -m "feat: add WhitePaperSection with free download and optional lead-gen form"
```

---

### Task 5: Wire WhitePaperSection into page.tsx

**Files:**
- Modify: `apps/website/src/app/page.tsx`

- [ ] **Step 1: Add import**

Add to the imports at the top of `apps/website/src/app/page.tsx`:

```tsx
import { WhitePaperSection } from '../components/landing/WhitePaperSection';
```

- [ ] **Step 2: Insert section**

Placement: after `<FairComparisonSection />`, before `<ArchDiagram />`.

If `FairComparisonSection` hasn't been added yet (this plan runs independently of the narrative redesign plan), place it after `<DeepAgentsShowcase />`, before `<ArchDiagram />`.

```tsx
{/* White paper free download */}
<WhitePaperSection />
```

- [ ] **Step 3: Final build check**

```bash
cd apps/website && ../../node_modules/.bin/next build --no-lint 2>&1 | tail -20
```

Expected: successful build

- [ ] **Step 4: End-to-end verification**

```bash
cd apps/website && ../../node_modules/.bin/next dev
```

1. Navigate to http://localhost:3000, scroll to WhitePaperSection
2. Click "↓ Download PDF" — verify browser downloads the PDF
3. Fill in email, click "Notify me" — verify success state appears
4. Check `apps/website/data/whitepaper-signups.ndjson` — verify entry was written

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/app/page.tsx
git commit -m "feat: add WhitePaperSection to landing page"
```
