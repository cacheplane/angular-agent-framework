# White Paper Generation Pipeline — Implementation Spec

## Goal

Build a one-time Anthropic SDK generation script that produces a static PDF white paper saved to `apps/website/public/whitepaper.pdf`. The white paper chapter structure is shaped by a six-dimension "production readiness assessment framework" that mirrors the six last-mile pain points. The website change is minimal: remove the current gate (if any), add a free download button, keep an optional lightweight lead-gen form.

## Architecture

**Script:** `apps/website/scripts/generate-whitepaper.ts` — runs once via `npx tsx`. Calls the Anthropic API to generate chapter content, then uses Puppeteer to render HTML → PDF. Output saved to `apps/website/public/whitepaper.pdf`.

**Command:** Added to root `package.json` scripts as `"generate-whitepaper": "npx tsx apps/website/scripts/generate-whitepaper.ts"`

**Website:** A new `WhitePaperSection` component added to the landing page. Free download link to `/whitepaper.pdf`. Optional lead-gen form (name + email, not required to download).

No new packages beyond Puppeteer. The Anthropic SDK (`@anthropic-ai/sdk`) is already in `devDependencies`. Puppeteer is installed as a dev dependency.

## Tech Stack

- `@anthropic-ai/sdk` (already present at `^0.79.0`)
- `puppeteer` (add as devDependency)
- `npx tsx` for script execution (same pattern as `generate-narrative-docs.ts`)
- Model: `claude-opus-4-5` (or env override via `ANTHROPIC_MODEL`)

---

## File Map

| Action | Path |
|--------|------|
| Create | `apps/website/scripts/generate-whitepaper.ts` |
| Create | `apps/website/src/components/landing/WhitePaperSection.tsx` |
| Modify | `package.json` (root) — add `generate-whitepaper` script |
| Modify | `apps/website/src/app/page.tsx` — add `<WhitePaperSection />` |

---

## Assessment Framework — Six Dimensions

These six dimensions map directly to the last-mile pain points described in the narrative. Each dimension becomes one chapter of the white paper.

| # | Dimension | Pain it addresses |
|---|-----------|-------------------|
| 1 | Streaming State Management | Wiring SSE streams into Angular without zone thrashing or custom glue |
| 2 | Thread Persistence | Resuming conversations across refreshes without custom API calls |
| 3 | Tool-Call Rendering | Showing tool execution state inline without parsing raw events |
| 4 | Human Approval Flows | Building interrupt UI that connects back to LangGraph resume |
| 5 | Generative UI | Agent-emitted Angular components without a framework for it |
| 6 | Deterministic Testing | Testing agent-driven components without a real server |

---

## Script: generate-whitepaper.ts

### Structure

```typescript
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const client = new Anthropic();
const MODEL = process.env['ANTHROPIC_MODEL'] ?? 'claude-opus-4-5';
const OUTPUT_PDF = 'apps/website/public/whitepaper.pdf';
const OUTPUT_HTML = 'apps/website/public/whitepaper-preview.html';
```

### Chapter definitions

```typescript
const CHAPTERS = [
  {
    id: 'streaming-state',
    title: 'Streaming State Management',
    dimension: 'Streaming State',
    prompt: `Write a 400-600 word chapter for an engineering white paper titled "From Prototype to Production: The Angular Agent Readiness Guide".

Chapter topic: Streaming State Management

Context: Angular teams building LangGraph-powered agents must wire SSE event streams into reactive UI. Without the right primitives, they end up with custom zone-patching, manual subscription management, and brittle token accumulation logic that breaks under load.

Cover:
- Why streaming state is hard in Angular (zone.js, change detection, timing)
- The signals-native approach: how agent() exposes messages() as Signal<AIMessage[]>
- How isStreaming() lets developers drive loading UI without polling
- Code example: minimal agent() setup (TypeScript snippet, 8-12 lines)
- Production checklist item: "Are your message signals OnPush-compatible?"

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
  },
  {
    id: 'thread-persistence',
    title: 'Thread Persistence',
    dimension: 'Thread Persistence',
    prompt: `Write a 400-600 word chapter for an engineering white paper titled "From Prototype to Production: The Angular Agent Readiness Guide".

Chapter topic: Thread Persistence

Context: Demos work with ephemeral state. Production agents need conversation history that survives page refreshes, tab switches, and navigation — wired to LangGraph's MemorySaver backend.

Cover:
- Why stateless agent UIs fail in production
- The threadId signal and onThreadId callback pattern
- How to persist threadId to localStorage and restore on mount
- Thread list UI and switching between conversations
- Code example: provideAgent() with threadId (8-12 lines)
- Production checklist item: "Does your agent UI resume threads correctly after a browser refresh?"

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
  },
  {
    id: 'tool-call-rendering',
    title: 'Tool-Call Rendering',
    dimension: 'Tool-Call Rendering',
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
    dimension: 'Human Approval Flows',
    prompt: `Write a 400-600 word chapter for an engineering white paper titled "From Prototype to Production: The Angular Agent Readiness Guide".

Chapter topic: Human Approval Flows (Interrupts)

Context: Production agents that take consequential actions — sending emails, deploying services, modifying data — must pause for human approval before proceeding. This requires a tight loop between LangGraph's interrupt() primitive and Angular UI.

Cover:
- The LangGraph interrupt() and Command.RESUME pattern
- Why polling and custom websocket approaches are brittle
- The interrupt() signal in agent() and how it maps to approval state
- <chat-interrupt> headless and <chat-interrupt-panel> prebuilt
- The three approval actions: approve, edit, cancel — and how each maps to a resume command
- Code example: interrupt signal binding (8-12 lines)
- Production checklist item: "Can your agent UI recover gracefully if a user cancels an interrupt?"

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
  },
  {
    id: 'generative-ui',
    title: 'Generative UI',
    dimension: 'Generative UI',
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
    dimension: 'Deterministic Testing',
    prompt: `Write a 400-600 word chapter for an engineering white paper titled "From Prototype to Production: The Angular Agent Readiness Guide".

Chapter topic: Deterministic Testing

Context: Agent UIs are notoriously hard to test because they depend on live LLM responses. Flaky tests, slow CI, and inability to reproduce edge cases are the main reasons agent UIs ship with low confidence.

Cover:
- Why testing agent components against real LLM APIs is impractical
- The MockAgentTransport approach: scripted event sequences, no server needed
- createMockAgentRef(): writable signals you control directly in tests
- How to test streaming, interrupts, tool calls, and generative UI in isolation
- Code example: createMockAgentRef() test pattern (10-14 lines)
- Production checklist item: "Do your agent component tests run offline and complete in under 100ms each?"

Tone: Direct, technical, peer-to-peer. No fluff. Audience is senior Angular engineers.`,
  },
];
```

### Generation function

```typescript
async function generateChapter(chapter: typeof CHAPTERS[0]): Promise<string> {
  console.log(`  Generating chapter: ${chapter.title}...`);
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: chapter.prompt }],
  });
  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected content type');
  return content.text;
}
```

### HTML template

The script builds a single HTML string with all chapters, then renders to PDF via Puppeteer.

```typescript
function buildHTML(chapters: Array<{ title: string; content: string }>): string {
  const chapterHTML = chapters.map((ch, i) => `
    <section class="chapter">
      <div class="chapter-num">Chapter ${i + 1}</div>
      <h2>${ch.title}</h2>
      <div class="chapter-body">${markdownToHTML(ch.content)}</div>
    </section>
  `).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; color: #1a1a2e; background: #fff; }

  .cover { height: 100vh; display: flex; flex-direction: column; justify-content: flex-end; padding: 80px 80px 100px; background: linear-gradient(135deg, #fef0f3 0%, #f4f0ff 45%, #eaf3ff 70%, #e6f4ff 100%); page-break-after: always; }
  .cover-eyebrow { font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #004090; font-weight: 700; margin-bottom: 24px; }
  .cover-title { font-family: 'EB Garamond', serif; font-size: 52px; font-weight: 800; line-height: 1.1; color: #1a1a2e; margin-bottom: 20px; }
  .cover-sub { font-family: 'EB Garamond', serif; font-style: italic; font-size: 20px; color: #555770; margin-bottom: 40px; }
  .cover-meta { font-size: 13px; color: #888; font-family: monospace; }

  .toc { padding: 80px; page-break-after: always; }
  .toc h2 { font-family: 'EB Garamond', serif; font-size: 32px; font-weight: 700; color: #1a1a2e; margin-bottom: 32px; }
  .toc-item { display: flex; align-items: baseline; gap: 8px; padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,.06); font-size: 15px; color: #444; }
  .toc-num { font-family: monospace; font-size: 11px; color: #004090; font-weight: 700; min-width: 24px; }
  .toc-title { flex: 1; }

  .chapter { padding: 80px; page-break-before: always; }
  .chapter-num { font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #004090; font-weight: 700; margin-bottom: 16px; }
  h2 { font-family: 'EB Garamond', serif; font-size: 36px; font-weight: 800; color: #1a1a2e; margin-bottom: 28px; line-height: 1.15; }
  .chapter-body p { font-size: 15px; line-height: 1.75; color: #333; margin-bottom: 18px; }
  .chapter-body h3 { font-family: 'EB Garamond', serif; font-size: 22px; font-weight: 700; color: #1a1a2e; margin: 28px 0 12px; }
  .chapter-body ul { margin: 0 0 18px 20px; }
  .chapter-body li { font-size: 15px; line-height: 1.7; color: #333; margin-bottom: 6px; }
  .chapter-body pre { background: #1a1b26; color: #c8ccee; padding: 20px 24px; border-radius: 8px; font-size: 13px; line-height: 1.65; overflow-x: auto; margin: 24px 0; }
  .chapter-body code { font-family: 'JetBrains Mono', monospace; font-size: 13px; }
  .checklist { background: rgba(0,64,144,.05); border: 1px solid rgba(0,64,144,.15); border-radius: 8px; padding: 16px 20px; margin: 24px 0; }
  .checklist-label { font-family: monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #004090; margin-bottom: 8px; }
  .checklist-item { font-size: 14px; color: #333; line-height: 1.6; }
</style>
</head>
<body>
  <!-- Cover -->
  <div class="cover">
    <div class="cover-eyebrow">Angular Agent Framework · Production Readiness Guide</div>
    <h1 class="cover-title">From Prototype<br>to Production</h1>
    <p class="cover-sub">The Angular Agent Readiness Guide</p>
    <div class="cover-meta">cacheplane.io · ${new Date().getFullYear()}</div>
  </div>

  <!-- TOC -->
  <div class="toc">
    <h2>Contents</h2>
    ${chapters.map((ch, i) => `
      <div class="toc-item">
        <span class="toc-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="toc-title">${ch.title}</span>
      </div>
    `).join('')}
  </div>

  <!-- Chapters -->
  ${chapterHTML}
</body>
</html>`;
}
```

### markdownToHTML helper

A minimal converter for the subset of Markdown the API will produce (headings, paragraphs, bold, code blocks, bullet lists). No external library needed:

```typescript
function markdownToHTML(md: string): string {
  return md
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hup]|<pre)(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}
```

### Puppeteer PDF export

```typescript
async function renderPDF(html: string, outputPath: string): Promise<void> {
  console.log('  Launching browser...');
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
```

### main()

```typescript
async function main() {
  console.log('Generating white paper...\n');
  const generatedChapters: Array<{ title: string; content: string }> = [];

  for (const chapter of CHAPTERS) {
    const content = await generateChapter(chapter);
    generatedChapters.push({ title: chapter.title, content });
  }

  console.log('\nBuilding HTML...');
  const html = buildHTML(generatedChapters);
  fs.writeFileSync(OUTPUT_HTML, html, 'utf8');

  console.log('Rendering PDF...');
  fs.mkdirSync(path.dirname(OUTPUT_PDF), { recursive: true });
  await renderPDF(html, OUTPUT_PDF);

  console.log(`\nDone. PDF saved to ${OUTPUT_PDF}`);
  console.log(`Preview HTML saved to ${OUTPUT_HTML}`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

---

## Website: WhitePaperSection Component

**Placement in page.tsx:** After `<FairComparisonSection />`, before `<ArchDiagram />`.

**File:** `apps/website/src/components/landing/WhitePaperSection.tsx`

### Design

Glass card, full-width within a max-width container, two columns:
- Left: eyebrow "Free Download", headline "From Prototype to Production", subtitle (1-2 sentences), download button linking to `/whitepaper.pdf`
- Right: optional lead-gen form — name field, email field, "Get notified of updates" submit button. The form is clearly marked optional with copy like "Optional — download above doesn't require this."

The download button uses `tokens.colors.accent` background. It is an `<a href="/whitepaper.pdf" download>` — no server round-trip, no gate.

### Lead-gen form behavior

Client component (`'use client'`). On submit, POST to a simple API route `apps/website/src/app/api/whitepaper-signup/route.ts` that writes to a JSON file at `apps/website/data/whitepaper-signups.json` (append-only, NDJSON format). No external service required. The API route returns 200 and the form shows a thank-you message.

### API route: whitepaper-signup

```typescript
// apps/website/src/app/api/whitepaper-signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), 'data/whitepaper-signups.json');

export async function POST(req: NextRequest) {
  const { name, email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  const entry = JSON.stringify({ name, email, ts: new Date().toISOString() }) + '\n';
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.appendFileSync(FILE, entry, 'utf8');

  return NextResponse.json({ ok: true });
}
```

---

## package.json Changes

Add to root `package.json` scripts:

```json
"generate-whitepaper": "npx tsx apps/website/scripts/generate-whitepaper.ts"
```

Add to root `devDependencies`:

```json
"puppeteer": "^22.0.0"
```

---

## page.tsx Changes

```tsx
import { WhitePaperSection } from '../components/landing/WhitePaperSection';
// ... after FairComparisonSection, before ArchDiagram:
<WhitePaperSection />
```

---

## Running the Script

```bash
# From repo root
npm install  # picks up puppeteer
npm run generate-whitepaper
# Output: apps/website/public/whitepaper.pdf
```

The script is run once by the team. The resulting PDF is committed to the repo and served statically. It does not run on every build. To regenerate, run the script again and commit the new PDF.

---

## Testing

1. Run `npm run generate-whitepaper` — verify PDF appears at `apps/website/public/whitepaper.pdf`
2. Open `apps/website/public/whitepaper-preview.html` in a browser — verify chapter formatting
3. Start dev server, navigate to landing page, verify `<WhitePaperSection>` renders with correct download link
4. Click download button — verify PDF downloads
5. Submit optional form — verify entry appears in `apps/website/data/whitepaper-signups.json`
