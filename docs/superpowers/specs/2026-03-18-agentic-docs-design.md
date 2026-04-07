# Angular Agent Framework — Agentic Docs & Hero Redesign Specification

**Date:** 2026-03-18
**Status:** Approved
**Extends:** `2026-03-18-website-branding-design.md`

---

## Overview

Two related changes to the Angular Agent Framework website:

1. **Hero redesign** — two-column layout, smaller headline, Angular red for "Angular", LangChain + Angular logo badges, a generative UI browser animation with mouse-reactive neon glow, and a "Copy prompt" CTA replacing the npm install strip.

2. **Agentic docs philosophy** — every doc page gets a "Copy prompt" button as its primary action. Docs exist for comprehension; the prompt is for execution. No separate "Use with AI" section — this *is* how the docs work. Supported by four agent artifacts (`CLAUDE.md`, `AGENTS.md`, `/llms.txt`, `/llms-full.txt`) and an MCP server package (`@angular/mcp`).

---

## 1. Hero Redesign

### Layout

Two-column, full viewport height, `pt-24` for nav clearance:

- **Left column** (55% width): text content, left-aligned
- **Right column** (45% width): browser frame SVG animation

On mobile (<768px): single column, text above animation, animation max-height 300px.

### Left Column

**Logo badges** — above the headline, inline flex row, gap 8px:
- LangChain badge: LangChain logo SVG + "LangChain" label. Logo source: inline SVG from `https://raw.githubusercontent.com/langchain-ai/langchain/master/docs/static/img/favicon.ico` converted to SVG, or use the text "LC" in a styled monogram if the SVG is unavailable. License: Apache 2.0 (attribution in footer).
- Angular badge: Angular logo SVG + "Angular" label. Logo source: inline SVG from `https://angular.io/assets/images/logos/angular/angular.svg` (official Angular press kit, free to use with attribution). Color: `#DD0031`.
- Badge style: `background: rgba(108,142,255,0.08)`, `border: 1px solid rgba(108,142,255,0.15)`, `border-radius: 20px`, `padding: 4px 10px 4px 8px`, `font-family: JetBrains Mono`, `font-size: 11px`, `color: #EEF1FF`

**Headline** — EB Garamond, `clamp(36px, 4.5vw, 72px)`, weight 800, line-height 1.05, `color: #EEF1FF`:

> The Enterprise Streaming Resource for LangChain and **Angular**

- "Angular" color: `#DD0031` (Angular brand red)
- "Angular" glow: `text-shadow: 0 0 30px rgba(221, 0, 49, 0.5)`
- No letter-reveal animation (reserved for the original centered hero — two-column layout doesn't benefit from it at this size)

**Subhead** — EB Garamond italic, `clamp(16px, 1.8vw, 20px)`, `color: #8B96C8`, `max-width: 44ch`, `margin-top: 20px`:

> Full parity with React `useStream()` — built natively for Angular 20+.

No mention of RxJS. RxJS is an internal implementation detail.

**"Copy prompt" CTA** — primary action, `margin-top: 32px`:
- Button: `background: #6C8EFF`, `color: #fff`, `font-family: JetBrains Mono`, `font-size: 13px`, `padding: 12px 24px`, `border-radius: 8px`
- Label: `⚡ Copy prompt`
- On click: copies the contents of `content/prompts/getting-started.md` to clipboard, label changes to `✓ Copied!` for 2s
- On hover: `box-shadow: 0 0 16px rgba(108,142,255,0.4)` (added to existing fill)
- Note: Hero CTA uses stronger glow (0.4) than docs-page button (0.25) because the hero is a marketing surface — higher visual energy is intentional. Docs pages are a reading environment — subtler glow reduces distraction.

**Secondary link** — below CTA, `margin-top: 12px`:
- `font-family: JetBrains Mono`, `font-size: 12px`, `color: #4A527A`
- Text: `npm install angular`
- No copy button — this is reference, not the primary action

### Right Column — Generative UI Animation

A browser chrome SVG showing a generative UI streaming sequence. The frame itself has a mouse-reactive neon glow.

**Browser frame:**
- macOS-style window: three traffic-light dots, URL bar showing `localhost:4200`
- Frame border: `1px solid rgba(108,142,255,0.4)`
- Frame background: `#080B14`
- Border radius: 10px
- Default glow: `box-shadow: 0 0 20px rgba(108,142,255,0.2)`

**Mouse-reactive glow:**
- `mousemove` event listener on the document
- Calculate distance from cursor to frame center
- Map distance 0–400px → glow intensity `0.6` → `0.15`
- Formula: `intensity = 0.15 + (0.45 * Math.max(0, 1 - distance / 400))`
- Applied as: `box-shadow: 0 0 ${20 + intensity * 60}px rgba(108,142,255,${intensity})`
- Smooth transition: `transition: box-shadow 0.1s ease-out`

**Animation sequence** (CSS keyframes loop, ~6s total):

The browser frame shows a generative UI building itself — demonstrating that angular is not just chat:

1. **0–1.5s:** Chat message appears word-by-word ("Here is your report...")
2. **1.5–3s:** A card component assembles — title fades in, then body text streams, then a button appears
3. **3–4.5s:** A table builds row-by-row (3 rows, each fading in)
4. **4.5–6s:** Brief pause, then fade out and restart

All elements styled with the indigo-blue token set. Animation is pure CSS keyframes — no Framer Motion. Framer Motion remains in use for the rest of the landing page (FeatureStrip scroll reveals, etc.) but `GenerativeUIFrame.tsx` is a self-contained SVG with CSS `@keyframes` only, so it works without a `'use client'` boundary and does not depend on the Framer Motion bundle.

---

## 2. Agentic Docs Philosophy

### Core Principle

Docs exist for **comprehension**. Prompts exist for **execution**. The developer reads to understand, then copies the prompt to act. These are two separate cognitive modes — the docs serve both without conflating them.

### "Copy prompt" Button

Every doc page has a "Copy prompt" button immediately below the page `h1`, before any prose. This is the primary action on the page.

**Style:**
- `background: transparent`
- `border: 1px solid rgba(108,142,255,0.4)`
- `color: #6C8EFF`
- `font-family: JetBrains Mono`
- `font-size: 12px`
- `padding: 8px 16px`
- `border-radius: 6px`
- Label: `⚡ Copy prompt`
- On click: copies the page's implementation prompt, label → `✓ Copied!` for 2s
- On hover: `box-shadow: 0 0 10px rgba(108,142,255,0.25)`

**Each doc page has exactly one prompt.** The prompt is task-specific and implementation-complete — paste it into any coding agent and it produces working code.

**Prompt file format:** Plain markdown, no front-matter. The entire file content is the prompt text — nothing else. Named by doc slug (e.g., `content/prompts/getting-started.md` corresponds to `/docs/getting-started`).

**Who writes prompts:** Developer-authored, committed alongside the library source. Updated manually when the API changes. Generated docs content (`content/docs/*.mdx`) is Claude-generated; prompts (`content/prompts/*.md`) are human-written and reviewed.

**How pages load their prompt:** `lib/docs.ts` exports `getPromptBySlug(slug: string[]): string | null` which reads `content/prompts/${slug.join('/')}.md` from disk at request time (Server Component). The `CopyPromptButton` receives the prompt string as a prop — no client-side fetch.

**Slug matching:** `CopyPromptButton` is rendered by the `[[...slug]]` page, which passes `params.slug` to `getPromptBySlug`. If no prompt file exists for a slug, the button is not rendered.

**Versioning:** Prompt files are updated on every library release that changes the public API. The publish workflow includes a lint step that checks all prompt files reference the current version number.

### Getting Started Page Structure

1. What angular does (2–3 sentences, no jargon)
2. "Copy prompt" button — the one-shot setup prompt, first interactive element on the page
3. Manual setup walkthrough (install, `provideAgent`, first component) — for developers who want to understand what the agent will do
4. "Add context to your project" section: brief explanation of `CLAUDE.md` / `AGENTS.md` with download links and inline content preview. No dedicated page — lives naturally here.
5. Links to deeper topics (Streaming, Thread Persistence, Configuration, Testing) — each with its own prompt

### Prompt Content Standards

Each prompt must:
- Be self-contained (no "see the docs" references)
- Specify the exact package name and version
- Include the key options the agent needs to make decisions (apiUrl, assistantId, threadPersistence Y/N)
- Fit in a single paste — under 400 words

---

## 3. Agent Artifacts

### `/llms.txt` and `/llms-full.txt`

Hosted at the site root. Generated at build time from `api-docs.json`.

**`/llms.txt`** — compact summary (~500 tokens):
- What angular is (2 sentences)
- Install command
- Key API surface: `agent()`, `provideAgent()`, `AgentRef` members
- One minimal example
- Link to `/llms-full.txt`

**`/llms-full.txt`** — complete reference (~8,000 tokens):
- Full TypeDoc API reference (flattened, no HTML)
- All prompt recipes (one per doc page)
- Common gotchas
- MCP server setup

Both files are plain text, no markdown formatting (for maximum compatibility across agent parsers).

### `CLAUDE.md`

Targets Claude Code and Claude API agents. Downloadable from the Getting Started doc page.

Content:
```markdown
# Angular Agent Framework

Angular streaming library for LangChain/LangGraph. Provides `agent()` — full parity with React's `useStream()`.

## Install
npm install angular

## Key requirement
`agent()` MUST be called within an Angular injection context (component constructor, field initializer, or `runInInjectionContext()`). Calling it outside an injection context throws.

## Basic usage
[complete minimal example]

## Key patterns
- Thread persistence: pass `threadId: signal(storedId)` + `onThreadId` callback
- Global config: `provideAgent({ apiUrl })` in app.config.ts
- Testing: use `MockAgentTransport` — never mock `agent()` itself

## MCP server
npx @angular/mcp  (add to Claude Code settings for tool access)

## Version
@VERSION@  — regenerate if stale: https://cacheplane.ai/llms-full.txt
```

### `AGENTS.md`

Identical content to `CLAUDE.md`. Targets OpenAI Codex, Cursor, GitHub Copilot Workspace, and any agent respecting the OpenAI agent file convention.

### Versioning

Both files contain a `@VERSION@` placeholder replaced at build time with the current library version from `package.json`. A version comment at the top tells agents when their copy may be stale. `CLAUDE.md` and `AGENTS.md` are updated on every library release as part of the publish workflow.

---

## 4. MCP Server — `@angular/mcp`

### Package

- **npm name:** `@angular/mcp`
- **Location in monorepo:** `packages/mcp/`
- **Runtime:** Node.js, `@modelcontextprotocol/sdk`
- **Data source:** reads `api-docs.json` (same TypeDoc output as the website)

### Tools

All tools return `{ content: [{ type: 'text', text: string }] }` per the MCP spec. The `text` field contains the result described below.

**`get_api_reference`**
- Input: `{ symbol: string }` — e.g. `"agent"`, `"AgentRef"`, `"provideAgent"`
- Returns: Markdown string. TypeDoc entry for the symbol: description, type signature, all parameters with types and descriptions, return type, example. Sourced from `api-docs.json`. If symbol not found, returns `"Symbol not found. Available symbols: [list]"`.

**`search_docs`**
- Input: `{ query: string }` — natural language or keyword
- Returns: Markdown string. Up to 5 matching doc sections, each formatted as `## [Page title > Section heading]\n[section text]\n`. Matched by simple substring search across flattened `llms-full.txt`. If no matches, returns `"No results for: [query]"`.

**`get_example`**
- Input: `{ pattern: string }` — one of: `"basic-chat"`, `"thread-persistence"`, `"system-prompt"`, `"mock-testing"`, `"interrupts"`, `"subagent-progress"`, `"custom-transport"`
- Returns: Markdown string containing a complete, runnable TypeScript/Angular code example for the pattern — full file with imports, component decorator, and usage comments. If pattern not in the registry, returns `"Unknown pattern. Available patterns: [list]"`.
- Source: hardcoded in `src/tools/get-example.ts` — not generated. Updated manually when the API changes.

**`scaffold_chat_component`**
- Input: `{ componentName: string, apiUrl: string, assistantId: string, threadPersistence: boolean }`
- Returns: Markdown string containing a single TypeScript source block — the complete `.ts` file for the component, ready to write to disk. Includes all imports, `@Component` decorator with inline template and styles, `agent()` call, submit handler, and (if `threadPersistence: true`) localStorage thread ID logic.

**`add_angular`**
- Input: `{ appConfigPath: string }` — absolute or workspace-relative path to `app.config.ts`
- Validation: if the file does not exist or does not contain `ApplicationConfig`, returns an error string: `"File not found or is not an Angular app.config.ts: [path]"`. Does not write files — returns a unified diff string the agent applies.
- Returns: Markdown string with two fenced blocks: (1) the `npm install` command, (2) a unified diff of `app.config.ts` showing `provideAgent({ apiUrl: 'REPLACE_ME' })` added to the `providers` array.

**`get_thread_persistence_pattern`**
- Input: `{ storageType: 'localStorage' | 'sessionStorage' | 'custom' }`
- Returns: Markdown string — complete Angular component code snippet showing how to initialise `threadId` signal from the chosen store, pass it to `agent()`, and persist via `onThreadId`. The `'custom'` variant returns the pattern with a `// TODO: replace with your store` comment where the storage call goes.

### Agent Config Snippets (displayed on Getting Started page)

```jsonc
// Claude Code — ~/.claude/settings.json
{
  "mcpServers": {
    "angular": { "command": "npx", "args": ["@angular/mcp"] }
  }
}
```

```jsonc
// Cursor — .cursor/mcp.json
{
  "mcpServers": {
    "angular": { "command": "npx", "args": ["@angular/mcp"] }
  }
}
```

```jsonc
// OpenAI Codex / any MCP-compatible agent
{
  "mcpServers": {
    "angular": { "command": "npx", "args": ["@angular/mcp"] }
  }
}
```

---

## 5. What Is Not Changing

- Brand token values (`#6C8EFF`, `#080B14`, etc.) from `2026-03-18-website-branding-design.md`
- Page structure and routes
- Pricing page, comparison table, lead form
- Docs sidebar and MDX rendering
- API reference page
- Playwright e2e test coverage requirements
- Vercel deployment configuration
- Angular Elements live demo

---

## 6. New Files Added to Website File Map

```
apps/website/
├── app/
│   ├── llms.txt/route.ts           # Serves /llms.txt
│   └── llms-full.txt/route.ts      # Serves /llms-full.txt
├── components/
│   └── landing/
│       ├── HeroTwoCol.tsx           # Replaces Hero.tsx
│       └── GenerativeUIFrame.tsx    # Browser frame SVG animation
├── components/
│   └── docs/
│       └── CopyPromptButton.tsx     # Reusable copy-prompt button
└── content/
    └── prompts/                     # One .md file per doc page
        ├── getting-started.md
        ├── streaming.md
        ├── thread-persistence.md
        ├── configuration.md
        └── testing.md

packages/mcp/
├── src/
│   ├── index.ts                     # MCP server entry point
│   ├── tools/
│   │   ├── get-api-reference.ts
│   │   ├── search-docs.ts
│   │   ├── get-example.ts
│   │   ├── scaffold-chat-component.ts
│   │   ├── add-angular.ts
│   │   └── get-thread-persistence-pattern.ts
│   └── data/
│       └── loader.ts                # Reads api-docs.json
├── package.json
└── project.json
```
