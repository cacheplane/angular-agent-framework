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
