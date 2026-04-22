# Docs Mode Redesign — Mintlify-Inspired with Agentic Prompts

## Problem

The current Docs mode renders markdown as a wall of prose with minimal visual hierarchy. Code blocks lack filename headers and copy buttons. There's no way for developers to copy prompts for agentic coding tools. The rendering doesn't match the quality bar set by modern doc platforms like Mintlify and Stripe.

## Goal

Redesign the Docs mode rendering to match Mintlify-quality standards: constrained content width, numbered steps with visual connectors, callout boxes (Tip/Note/Warning), polished code blocks with filename headers and copy buttons, API reference tables, and a new agentic prompt block that lets developers copy ready-made prompts for Claude/Cursor/Copilot.

## Component Library

Six component types rendered in Docs mode:

### 1. Numbered Steps

Vertical step indicators with connecting lines. Each step has a numbered circle, title, and content body. Steps can contain code blocks and prose.

### 2. Callout Boxes

Three variants — Tip (blue/cyan), Note (yellow), Warning (red). Colored left border or subtle background tint. Icon + uppercase label + content.

### 3. Code Blocks

Fenced code blocks render with:
- Filename header (extracted from a comment on the first line: `// app.config.ts`)
- Language badge (TypeScript, Python, HTML)
- Copy button (copies raw code to clipboard)
- Shiki syntax highlighting (github-dark theme, same as Code mode)

### 4. Agentic Prompt Blocks

Purple-themed blocks containing copy-ready prompts for AI coding assistants. Header with robot icon + "Agentic Prompt" label + "Copy prompt" button. Content is plain prose describing what the AI should build, referencing specific APIs and patterns.

### 5. API Reference Tables

Styled tables for Signal/method reference. Monospace property names, type column, description. Clean header with uppercase labels.

### 6. Summary Box

Appears below the title. Brief description of what the guide covers. Cyan-tinted background.

## Markdown Authoring Format

Authors write `guide.md` files using standard markdown with HTML component tags:

```markdown
# Streaming with angular

<Summary>
Build a real-time streaming chat with Angular + LangGraph.
</Summary>

<Steps>
<Step title="Configure the provider">

Set up `provideAgent()` in your app config:

```typescript
// app.config.ts
import { provideAgent } from '@cacheplane/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [provideAgent({ apiUrl: '...' })],
};
```

</Step>
<Step title="Create the streaming resource">

Call `agent()` in a field initializer:

```typescript
// streaming.component.ts
protected readonly stream = agent({
  assistantId: 'streaming',
});
```

</Step>
</Steps>

<Tip>
No service layer needed — `agent()` replaces wrapper services.
</Tip>

<Warning>
Never expose your LangSmith API key in client-side code.
</Warning>

<Prompt>
Add real-time LLM streaming to this Angular component using
`agent()` from `@cacheplane/langgraph`. Configure
`provideAgent({ apiUrl })` in the app config, then call
`stream.submit()` to send messages. Bind `stream.messages()` in the
template using `@for` — all Signals, no subscriptions needed.
</Prompt>

<ApiTable>
| Signal | Type | Description |
|--------|------|-------------|
| `messages()` | `BaseMessage[]` | Conversation messages |
| `isLoading()` | `boolean` | True while streaming |
| `error()` | `unknown` | Last error if any |
| `status()` | `ResourceStatus` | Idle, loading, resolved, error |
</ApiTable>
```

Files remain readable in GitHub and VS Code. The HTML tags are ignored by standard markdown renderers and only processed by the cockpit's `renderMarkdown()`.

## Rendering Pipeline

`renderMarkdown()` in `apps/cockpit/src/lib/render-markdown.ts` is updated:

1. **Pre-process HTML tags** — Extract `<Steps>`, `<Step>`, `<Tip>`, `<Note>`, `<Warning>`, `<Prompt>`, `<Summary>`, `<ApiTable>` blocks. Replace with placeholder markers.
2. **Parse with `marked`** — Standard markdown → HTML (headings, paragraphs, lists, inline code).
3. **Highlight code blocks with Shiki** — Same as current. Additionally extract filename from first-line comment (`// filename.ts`).
4. **Post-process placeholders** — Replace markers with styled HTML for each component type:
   - Steps → numbered circles + connecting vertical lines + step content
   - Callouts → colored border/background boxes with icon + label
   - Prompt → purple-themed block with copy button (client-side JS for clipboard)
   - Summary → cyan-tinted box below title
   - ApiTable → styled table with monospace columns
5. **Wrap code blocks** — Add filename header + language badge + copy button div around Shiki output.

## Client-Side Interactivity

Two interactive features require client-side JavaScript:

1. **Copy code** — Click the copy button on code blocks → copies raw code to clipboard
2. **Copy prompt** — Click the copy button on agentic prompt blocks → copies prompt text to clipboard

These are implemented as a small inline `<script>` appended to the rendered HTML, or as event delegation in the NarrativeDocs component.

## NarrativeDocs Component Changes

The component currently uses `dangerouslySetInnerHTML` to render the HTML. It needs:

1. Updated prose styling for the new components (Steps, Callouts, Prompt blocks)
2. A `useEffect` to attach clipboard event handlers to copy buttons after render
3. Constrained content width: `max-w-[720px] mx-auto` for readable line lengths

## File Changes

| Action | File | Change |
|--------|------|--------|
| Modify | `apps/cockpit/src/lib/render-markdown.ts` | Add component tag parsing + styled HTML output |
| Modify | `apps/cockpit/src/lib/render-markdown.spec.ts` | Tests for each component type |
| Modify | `apps/cockpit/src/components/narrative-docs/narrative-docs.tsx` | Constrained width, copy button handlers |
| Modify | `apps/cockpit/src/components/narrative-docs/narrative-docs.spec.tsx` | Updated tests |
| Modify | `apps/cockpit/src/app/cockpit.css` | CSS for doc components (steps, callouts, prompts, tables) |
| Modify | `cockpit/langgraph/streaming/python/docs/guide.md` | Rewrite with component tags |

## Out of Scope

- Table of contents sidebar within Docs mode
- Search within docs
- Anchor links on headings
- Dark/light theme toggle (always dark)
- Tab groups within docs (e.g., npm vs pnpm)
