# Docs Mode Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Docs mode rendering to match Mintlify-quality standards with numbered steps, callout boxes, polished code blocks, API tables, and agentic prompt copy blocks.

**Architecture:** Enhance `renderMarkdown()` to pre-process HTML component tags (`<Steps>`, `<Tip>`, `<Prompt>`, etc.) before `marked` parses the markdown, then post-process them into styled HTML. Add CSS for all doc components in `cockpit.css`. Update `NarrativeDocs` component with constrained width and clipboard handlers. Rewrite `guide.md` with the new component tags.

**Tech Stack:** `marked`, Shiki, Tailwind CSS, vanilla JS clipboard API

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `apps/cockpit/src/lib/render-markdown.ts` | Parse component tags, produce styled HTML |
| Modify | `apps/cockpit/src/lib/render-markdown.spec.ts` | Tests for each component type |
| Modify | `apps/cockpit/src/app/cockpit.css` | Styles for doc components |
| Modify | `apps/cockpit/src/components/narrative-docs/narrative-docs.tsx` | Constrained width, clipboard handlers |
| Modify | `cockpit/langgraph/streaming/python/docs/guide.md` | Rewrite with component tags |

---

### Task 1: Enhance renderMarkdown with component tag parsing

**Files:**
- Modify: `apps/cockpit/src/lib/render-markdown.ts`
- Modify: `apps/cockpit/src/lib/render-markdown.spec.ts`

This is the core task. The `renderMarkdown()` function needs to:
1. Pre-process HTML component tags into placeholders before `marked` runs
2. Let `marked` handle standard markdown
3. Post-process: replace placeholders with styled HTML
4. Wrap Shiki code blocks with filename headers + copy buttons

- [ ] **Step 1: Write failing tests for component tag parsing**

Add to `apps/cockpit/src/lib/render-markdown.spec.ts`:

```ts
it('renders Summary blocks', async () => {
  const md = '# Test\n\n<Summary>\nBuild a streaming chat.\n</Summary>';
  const result = await renderMarkdown(md);
  expect(result.html).toContain('doc-summary');
  expect(result.html).toContain('Build a streaming chat.');
});

it('renders Tip callout blocks', async () => {
  const md = '# Test\n\n<Tip>\nNo service layer needed.\n</Tip>';
  const result = await renderMarkdown(md);
  expect(result.html).toContain('doc-callout');
  expect(result.html).toContain('doc-callout--tip');
  expect(result.html).toContain('No service layer needed.');
});

it('renders Note callout blocks', async () => {
  const md = '# Test\n\n<Note>\nInjection context required.\n</Note>';
  const result = await renderMarkdown(md);
  expect(result.html).toContain('doc-callout--note');
});

it('renders Warning callout blocks', async () => {
  const md = '# Test\n\n<Warning>\nDo not expose API keys.\n</Warning>';
  const result = await renderMarkdown(md);
  expect(result.html).toContain('doc-callout--warning');
});

it('renders Steps with numbered step indicators', async () => {
  const md = '# Test\n\n<Steps>\n<Step title="First step">\n\nDo this first.\n\n</Step>\n<Step title="Second step">\n\nThen this.\n\n</Step>\n</Steps>';
  const result = await renderMarkdown(md);
  expect(result.html).toContain('doc-steps');
  expect(result.html).toContain('doc-step');
  expect(result.html).toContain('First step');
  expect(result.html).toContain('Second step');
  expect(result.html).toContain('doc-step__number');
});

it('renders Prompt blocks with copy button', async () => {
  const md = '# Test\n\n<Prompt>\nAdd streaming to this component.\n</Prompt>';
  const result = await renderMarkdown(md);
  expect(result.html).toContain('doc-prompt');
  expect(result.html).toContain('Add streaming to this component.');
  expect(result.html).toContain('data-copy-prompt');
});

it('renders ApiTable blocks as styled tables', async () => {
  const md = '# Test\n\n<ApiTable>\n| Signal | Type |\n|--------|------|\n| `messages()` | `BaseMessage[]` |\n</ApiTable>';
  const result = await renderMarkdown(md);
  expect(result.html).toContain('doc-api-table');
  expect(result.html).toContain('messages()');
});

it('wraps code blocks with filename header when first line is a comment', async () => {
  mockCodeToHtml.mockResolvedValue('<pre class="shiki"><code>code</code></pre>');
  const md = '# Test\n\n```typescript\n// app.config.ts\nconst x = 1;\n```';
  const result = await renderMarkdown(md);
  expect(result.html).toContain('doc-codeblock__header');
  expect(result.html).toContain('app.config.ts');
  expect(result.html).toContain('data-copy-code');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test cockpit -- --run --testPathPattern=render-markdown`
Expected: FAIL

- [ ] **Step 3: Implement the enhanced renderMarkdown**

Replace `apps/cockpit/src/lib/render-markdown.ts` entirely:

```ts
import { marked } from 'marked';
import { codeToHtml } from 'shiki';

export interface RenderedMarkdown {
  title: string;
  html: string;
}

// --- Component tag extraction ---

interface ExtractedBlock {
  placeholder: string;
  type: string;
  content: string;
  attrs: Record<string, string>;
}

const COMPONENT_TAGS = ['Summary', 'Tip', 'Note', 'Warning', 'Prompt', 'ApiTable', 'Steps', 'Step'];

function extractComponentTags(source: string): { cleaned: string; blocks: ExtractedBlock[] } {
  const blocks: ExtractedBlock[] = [];
  let cleaned = source;
  let idx = 0;

  for (const tag of COMPONENT_TAGS) {
    // Match <Tag ...attrs>content</Tag> (including self-nesting for Steps/Step)
    const pattern = new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
    cleaned = cleaned.replace(pattern, (_match, rawAttrs, content) => {
      const placeholder = `<!--COMPONENT_${idx}-->`;
      const attrs: Record<string, string> = {};
      if (rawAttrs) {
        const attrPattern = /(\w+)="([^"]*)"/g;
        let attrMatch;
        while ((attrMatch = attrPattern.exec(rawAttrs)) !== null) {
          attrs[attrMatch[1]] = attrMatch[2];
        }
      }
      blocks.push({ placeholder, type: tag, content: content.trim(), attrs });
      idx++;
      return placeholder;
    });
  }

  return { cleaned, blocks };
}

// --- Styled HTML builders ---

function renderSummary(content: string): string {
  return `<div class="doc-summary">${content}</div>`;
}

function renderCallout(type: 'tip' | 'note' | 'warning', content: string): string {
  const icons = { tip: '💡', note: '⚠️', warning: '🚨' };
  const labels = { tip: 'Tip', note: 'Note', warning: 'Warning' };
  return `<div class="doc-callout doc-callout--${type}">
    <div class="doc-callout__label">${icons[type]} ${labels[type]}</div>
    <div class="doc-callout__content">${content}</div>
  </div>`;
}

function renderSteps(content: string, allBlocks: ExtractedBlock[]): string {
  // Steps content contains Step placeholders — resolve them
  let resolved = content;
  let stepNum = 0;
  for (const block of allBlocks) {
    if (block.type === 'Step' && resolved.includes(block.placeholder)) {
      stepNum++;
      const stepHtml = `<div class="doc-step">
        <div class="doc-step__indicator">
          <div class="doc-step__number">${stepNum}</div>
          <div class="doc-step__line"></div>
        </div>
        <div class="doc-step__body">
          <div class="doc-step__title">${block.attrs['title'] ?? `Step ${stepNum}`}</div>
          <div class="doc-step__content">${block.content}</div>
        </div>
      </div>`;
      resolved = resolved.replace(block.placeholder, stepHtml);
    }
  }
  return `<div class="doc-steps">${resolved}</div>`;
}

function renderPrompt(content: string): string {
  return `<div class="doc-prompt">
    <div class="doc-prompt__header">
      <span class="doc-prompt__label">🤖 Agentic Prompt</span>
      <button class="doc-prompt__copy" data-copy-prompt>Copy prompt</button>
    </div>
    <div class="doc-prompt__content">${content}</div>
  </div>`;
}

function renderApiTable(content: string): string {
  return `<div class="doc-api-table">${content}</div>`;
}

function wrapCodeBlock(shikiHtml: string, lang: string, filename: string | null): string {
  const langLabel = lang !== 'text' ? `<span class="doc-codeblock__lang">${lang}</span>` : '';
  const fileLabel = filename ? `<span class="doc-codeblock__file">${filename}</span>` : '';
  const header = (fileLabel || langLabel)
    ? `<div class="doc-codeblock__header">${fileLabel}${langLabel}<button class="doc-codeblock__copy" data-copy-code>Copy</button></div>`
    : '';
  return `<div class="doc-codeblock">${header}${shikiHtml}</div>`;
}

function extractFilename(code: string): { filename: string | null; cleanedCode: string } {
  const firstLine = code.split('\n')[0];
  const commentMatch = firstLine?.match(/^\/\/\s*(.+\.\w+)\s*$/);
  if (commentMatch) {
    return { filename: commentMatch[1], cleanedCode: code.split('\n').slice(1).join('\n') };
  }
  const pyComment = firstLine?.match(/^#\s*(.+\.\w+)\s*$/);
  if (pyComment) {
    return { filename: pyComment[1], cleanedCode: code.split('\n').slice(1).join('\n') };
  }
  return { filename: null, cleanedCode: code };
}

// --- Main function ---

export async function renderMarkdown(source: string): Promise<RenderedMarkdown> {
  const titleMatch = source.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? '';

  // 1. Extract component tags
  const { cleaned, blocks } = extractComponentTags(source);

  // 2. Collect fenced code blocks for Shiki
  const codeBlocks: Array<{ lang: string; code: string; placeholder: string }> = [];
  let codeIdx = 0;

  const renderer = new marked.Renderer();
  renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
    const placeholder = `<!--SHIKI_BLOCK_${codeIdx}-->`;
    codeBlocks.push({ lang: lang ?? 'text', code: text, placeholder });
    codeIdx++;
    return placeholder;
  };

  // 3. Parse markdown
  let html = await marked.parse(cleaned, { renderer });

  // 4. Replace Shiki placeholders with highlighted + wrapped code
  for (const block of codeBlocks) {
    const { filename, cleanedCode } = extractFilename(block.code);
    const codeToHighlight = filename ? cleanedCode : block.code;
    let highlighted: string;
    try {
      highlighted = await codeToHtml(codeToHighlight, { lang: block.lang, theme: 'github-dark' });
    } catch {
      const escaped = codeToHighlight.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      highlighted = `<pre><code>${escaped}</code></pre>`;
    }
    html = html.replace(block.placeholder, wrapCodeBlock(highlighted, block.lang, filename));
  }

  // 5. Replace component tag placeholders with styled HTML
  for (const block of blocks) {
    if (!html.includes(block.placeholder)) continue;

    let rendered: string;
    switch (block.type) {
      case 'Summary':
        rendered = renderSummary(block.content);
        break;
      case 'Tip':
        rendered = renderCallout('tip', block.content);
        break;
      case 'Note':
        rendered = renderCallout('note', block.content);
        break;
      case 'Warning':
        rendered = renderCallout('warning', block.content);
        break;
      case 'Steps':
        rendered = renderSteps(block.content, blocks);
        break;
      case 'Step':
        // Steps already resolved by renderSteps — skip orphan steps
        rendered = '';
        break;
      case 'Prompt':
        rendered = renderPrompt(block.content);
        break;
      case 'ApiTable': {
        // Parse the table markdown inside ApiTable
        const tableHtml = await marked.parse(block.content);
        rendered = renderApiTable(tableHtml);
        break;
      }
      default:
        rendered = block.content;
    }
    html = html.replace(block.placeholder, rendered);
  }

  return { title, html };
}
```

- [ ] **Step 4: Run tests**

Run: `npx nx test cockpit -- --run --testPathPattern=render-markdown`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/lib/render-markdown.ts apps/cockpit/src/lib/render-markdown.spec.ts
git commit -m "feat(cockpit): enhance renderMarkdown with component tag parsing"
```

---

### Task 2: Add CSS for doc components

**Files:**
- Modify: `apps/cockpit/src/app/cockpit.css`

- [ ] **Step 1: Add doc component styles after the existing Shiki rule**

Append to `apps/cockpit/src/app/cockpit.css`:

```css
/* ── Doc components ────────────────────────────────────────── */

.doc-summary {
  background: rgba(125, 211, 252, 0.06);
  border: 1px solid rgba(125, 211, 252, 0.15);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
  color: var(--muted-foreground);
  line-height: 1.6;
}

/* Callouts */
.doc-callout {
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  margin: 1.25rem 0;
  font-size: 0.85rem;
  line-height: 1.6;
}
.doc-callout__label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.25rem;
}
.doc-callout__content {
  color: #c8d6e5;
}
.doc-callout--tip {
  background: rgba(125, 211, 252, 0.06);
  border: 1px solid rgba(125, 211, 252, 0.15);
}
.doc-callout--tip .doc-callout__label { color: var(--primary); }
.doc-callout--note {
  background: rgba(250, 204, 21, 0.04);
  border: 1px solid rgba(250, 204, 21, 0.15);
}
.doc-callout--note .doc-callout__label { color: #facc15; }
.doc-callout--warning {
  background: rgba(255, 107, 107, 0.04);
  border: 1px solid rgba(255, 107, 107, 0.15);
}
.doc-callout--warning .doc-callout__label { color: #ff6b6b; }

/* Steps */
.doc-steps {
  margin: 1.5rem 0;
}
.doc-step {
  display: flex;
  gap: 0.75rem;
}
.doc-step__indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}
.doc-step__number {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: rgba(125, 211, 252, 0.15);
  color: var(--primary);
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.doc-step__line {
  width: 2px;
  flex: 1;
  background: rgba(125, 211, 252, 0.12);
  margin: 0.375rem 0;
  min-height: 1rem;
}
.doc-step:last-child .doc-step__line { display: none; }
.doc-step__body {
  flex: 1;
  padding-bottom: 1.5rem;
}
.doc-step:last-child .doc-step__body { padding-bottom: 0; }
.doc-step__title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--foreground);
  margin-bottom: 0.25rem;
}
.doc-step__content {
  font-size: 0.85rem;
  color: var(--muted-foreground);
  line-height: 1.7;
}
.doc-step__content p { margin: 0.5rem 0; }

/* Code blocks */
.doc-codeblock {
  border: 1px solid rgba(138, 170, 214, 0.12);
  border-radius: 0.5rem;
  overflow: hidden;
  margin: 0.75rem 0;
}
.doc-codeblock__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid rgba(138, 170, 214, 0.12);
  background: rgba(22, 27, 34, 0.8);
  font-size: 0.7rem;
}
.doc-codeblock__file {
  color: var(--foreground);
  font-family: var(--font-mono);
}
.doc-codeblock__lang {
  padding: 0.1rem 0.35rem;
  border-radius: 0.2rem;
  background: rgba(125, 211, 252, 0.1);
  color: var(--primary);
  font-size: 0.6rem;
}
.doc-codeblock__copy {
  margin-left: auto;
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 0.65rem;
  cursor: pointer;
}
.doc-codeblock__copy:hover { color: var(--foreground); }
.doc-codeblock pre.shiki {
  margin: 0;
  border-radius: 0;
  border: none;
}

/* Agentic prompt */
.doc-prompt {
  background: rgba(168, 85, 247, 0.04);
  border: 1px solid rgba(168, 85, 247, 0.2);
  border-radius: 0.5rem;
  overflow: hidden;
  margin: 1.25rem 0;
}
.doc-prompt__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(168, 85, 247, 0.15);
  background: rgba(168, 85, 247, 0.06);
}
.doc-prompt__label {
  font-size: 0.7rem;
  font-weight: 600;
  color: #c084fc;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.doc-prompt__copy {
  font-size: 0.65rem;
  color: #c084fc;
  padding: 0.1rem 0.5rem;
  border: 1px solid rgba(168, 85, 247, 0.25);
  border-radius: 0.25rem;
  background: rgba(168, 85, 247, 0.08);
  cursor: pointer;
}
.doc-prompt__copy:hover { background: rgba(168, 85, 247, 0.15); }
.doc-prompt__content {
  padding: 0.75rem;
  font-size: 0.85rem;
  color: #d4c6e8;
  line-height: 1.7;
}
.doc-prompt__content code {
  background: rgba(168, 85, 247, 0.1);
  padding: 0.1rem 0.3rem;
  border-radius: 0.2rem;
  color: #c084fc;
  font-size: 0.8rem;
}

/* API table */
.doc-api-table {
  margin: 1.25rem 0;
}
.doc-api-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}
.doc-api-table th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  color: var(--muted-foreground);
  font-weight: 500;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid var(--border);
}
.doc-api-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(138, 170, 214, 0.08);
  color: #c8d6e5;
}
.doc-api-table code {
  background: rgba(125, 211, 252, 0.1);
  padding: 0.1rem 0.3rem;
  border-radius: 0.2rem;
  color: var(--primary);
  font-size: 0.75rem;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/cockpit/src/app/cockpit.css
git commit -m "feat(cockpit): add CSS for doc components (steps, callouts, prompts, tables)"
```

---

### Task 3: Update NarrativeDocs with constrained width and clipboard handlers

**Files:**
- Modify: `apps/cockpit/src/components/narrative-docs/narrative-docs.tsx`

- [ ] **Step 1: Update the component**

```tsx
'use client';

import React, { useEffect, useRef } from 'react';

interface NarrativeDoc {
  title: string;
  html: string;
  sourceFile: string;
}

interface NarrativeDocsProps {
  narrativeDocs: NarrativeDoc[];
}

export function NarrativeDocs({ narrativeDocs }: NarrativeDocsProps) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Copy code block
      if (target.closest('[data-copy-code]')) {
        const codeBlock = target.closest('.doc-codeblock');
        const code = codeBlock?.querySelector('pre code')?.textContent ?? '';
        navigator.clipboard.writeText(code);
        target.textContent = 'Copied!';
        setTimeout(() => { target.textContent = 'Copy'; }, 1500);
        return;
      }

      // Copy agentic prompt
      if (target.closest('[data-copy-prompt]')) {
        const promptBlock = target.closest('.doc-prompt');
        const text = promptBlock?.querySelector('.doc-prompt__content')?.textContent ?? '';
        navigator.clipboard.writeText(text);
        target.textContent = 'Copied!';
        setTimeout(() => { target.textContent = 'Copy prompt'; }, 1500);
        return;
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [narrativeDocs]);

  if (narrativeDocs.length === 0) {
    return (
      <section aria-label="Docs mode" className="grid place-items-center h-full text-muted-foreground text-sm">
        <p>No documentation available for this capability.</p>
      </section>
    );
  }

  return (
    <section ref={containerRef} aria-label="Docs mode" className="h-full overflow-auto py-6 px-4">
      {narrativeDocs.map((doc) => (
        <article
          key={doc.sourceFile}
          className="max-w-[720px] mx-auto text-[0.9rem] leading-relaxed text-foreground/85
            [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-foreground [&_h1]:mb-2 [&_h1]:pb-3 [&_h1]:border-b [&_h1]:border-border
            [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h2]:mt-10 [&_h2]:mb-3
            [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2
            [&_p]:mb-3 [&_p]:leading-relaxed
            [&_ul]:mb-3 [&_ul]:pl-5 [&_ul]:list-disc
            [&_li]:mb-1 [&_li]:leading-relaxed
            [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline
            [&_code]:text-primary [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.85em] [&_code]:font-mono
            [&_strong]:text-foreground [&_strong]:font-semibold"
          dangerouslySetInnerHTML={{ __html: doc.html }}
        />
      ))}
    </section>
  );
}
```

Key changes:
- Added `'use client'` for the `useEffect` clipboard handler
- `useRef` on the container for event delegation
- `useEffect` attaches click handlers for `[data-copy-code]` and `[data-copy-prompt]`
- Content constrained to `max-w-[720px] mx-auto`
- Replaced `prose` classes with targeted `[&_tag]` selectors for full control
- Added `py-6 px-4` for breathing room

- [ ] **Step 2: Commit**

```bash
git add apps/cockpit/src/components/narrative-docs/narrative-docs.tsx
git commit -m "feat(cockpit): update NarrativeDocs with constrained width and clipboard"
```

---

### Task 4: Rewrite guide.md with component tags

**Files:**
- Modify: `cockpit/langgraph/streaming/python/docs/guide.md`

- [ ] **Step 1: Replace guide.md with the component-tagged version**

```markdown
# Streaming with angular

<Summary>
Build a real-time streaming chat interface using `agent()` from
`@cacheplane/langgraph` connected to a LangGraph backend on LangSmith Cloud.
</Summary>

<Prompt>
Add real-time LLM streaming to this Angular component using `agent()` from `@cacheplane/langgraph`. Configure `provideAgent({ apiUrl })` in the app config, then call `stream.submit()` to send messages. Bind `stream.messages()` in the template using `@for` — all Signals, no subscriptions needed.
</Prompt>

<Steps>
<Step title="Configure the provider">

Set up `provideAgent()` in your app config with the LangGraph Cloud URL:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@cacheplane/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({
      apiUrl: 'https://your-deployment.langgraph.app',
    }),
  ],
};
```

This makes the API URL available to all `agent()` calls in your app.

</Step>
<Step title="Create the streaming resource">

In your component, call `agent()` in a field initializer (injection context required):

```typescript
// streaming.component.ts
import { agent } from '@cacheplane/langgraph';

export class StreamingComponent {
  protected readonly stream = agent({
    assistantId: 'streaming',
  });
}
```

<Note>
`agent()` must be called within an Angular injection context — a component field initializer or constructor body.
</Note>

</Step>
<Step title="Bind the template">

Use Angular's control flow to render messages reactively:

```html
@for (msg of stream.messages(); track $index) {
  <div [class]="'message--' + msg.getType()">
    {{ msg.content }}
  </div>
}
```

The template re-renders automatically as tokens arrive — no manual subscriptions or change detection needed.

</Step>
<Step title="Submit messages">

Call `stream.submit()` with a LangGraph message payload:

```typescript
// streaming.component.ts
send(): void {
  const text = this.prompt().trim();
  if (!text || this.stream.isLoading()) return;
  this.prompt.set('');
  this.stream.submit({
    messages: [{ role: 'human', content: text }],
  });
}
```

The submit call opens a streaming connection to the LangGraph backend. As tokens arrive, `stream.messages()` updates reactively.

</Step>
<Step title="Deploy the LangGraph backend">

The backend is a LangGraph `StateGraph` deployed to LangSmith Cloud:

```python
# graph.py
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI

def build_streaming_graph():
    llm = ChatOpenAI(model="gpt-4o-mini", streaming=True)

    async def generate(state):
        response = await llm.ainvoke(state["messages"])
        return {"messages": [response]}

    graph = StateGraph(dict)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)
    return graph.compile()
```

Deploy with `langgraph deploy` from `langgraph-cli`. The `assistantId` in your Angular code must match the graph name in `langgraph.json`.

</Step>
</Steps>

<Tip>
No service layer needed — `agent()` replaces wrapper services entirely. It handles connection lifecycle, state management, and error recovery.
</Tip>

<Warning>
Never expose your LangSmith API key in client-side code. Use server-side environment variables or a proxy.
</Warning>

## API Reference

<ApiTable>
| Signal | Type | Description |
|--------|------|-------------|
| `messages()` | `BaseMessage[]` | Conversation messages |
| `isLoading()` | `boolean` | True while streaming |
| `error()` | `unknown` | Last error if any |
| `status()` | `ResourceStatus` | Idle, loading, resolved, error |
| `hasValue()` | `boolean` | True once any data arrived |
</ApiTable>

<ApiTable>
| Method | Description |
|--------|-------------|
| `submit(payload)` | Fire the stream with a message payload |
| `stop()` | Abort the current stream |
| `reload()` | Re-submit the last payload |
| `switchThread(id)` | Switch to a different conversation thread |
</ApiTable>
```

- [ ] **Step 2: Commit**

```bash
git add cockpit/langgraph/streaming/python/docs/guide.md
git commit -m "docs(cockpit): rewrite streaming guide with component tags"
```

---

### Task 5: Fix tests and verify

**Files:**
- Modify: Various test files as needed

- [ ] **Step 1: Run full test suite**

Run: `npx nx test cockpit -- --run --reporter=verbose`

- [ ] **Step 2: Fix any failures**

The NarrativeDocs component now has `'use client'` and `useRef`/`useEffect` — tests using `renderToStaticMarkup` should still work since hooks don't fire in static rendering. If tests fail, update them.

- [ ] **Step 3: Run tests again**

Expected: ALL PASS

- [ ] **Step 4: Commit any fixes**

```bash
git add apps/cockpit/src
git commit -m "test(cockpit): update tests for docs mode redesign"
```

---

### Task 6: Visual verification

- [ ] **Step 1: Restart dev server and verify Docs mode at 1440x900**

Check:
- Summary box with cyan tint below title
- Numbered steps with connected vertical lines
- Code blocks with filename headers, language badges, and copy buttons
- Callout boxes (Tip in blue, Note in yellow, Warning in red)
- Agentic prompt block in purple with "Copy prompt" button
- API reference tables with styled headers
- Content constrained to ~720px width
- Copy buttons work (code + prompts)

- [ ] **Step 2: Push**

```bash
git push
```
