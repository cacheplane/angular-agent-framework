# @threadplane/chat

Drop-in agent chat UI for Angular 20+. Headless UI primitives plus opinionated compositions that read a runtime-neutral `Agent` contract — ship a production chat surface in days without coupling to a specific backend.

Part of [Threadplane](https://github.com/cacheplane/angular-agent-framework).

<p>
  <a href="https://www.npmjs.com/package/@threadplane/chat">
    <img alt="npm version" src="https://img.shields.io/npm/v/@threadplane%2Fchat?color=6C8EFF&labelColor=080B14&style=flat-square" />
  </a>
  <img alt="Angular 20+" src="https://img.shields.io/badge/Angular-20%2B%20%7C%2021-6C8EFF?labelColor=080B14&style=flat-square" />
  <img alt="License" src="https://img.shields.io/badge/License-PolyForm%20NC%20%7C%20Commercial-6C8EFF?labelColor=080B14&style=flat-square" />
</p>

**Source-available.** Free for noncommercial use under PolyForm Noncommercial License 1.0.0. Commercial production use — SaaS, internal tools, agency work, paid client projects — requires a [Threadplane Commercial license](https://threadplane.ai/pricing).

---

## What it does

- **Full chat surface in one tag.** `<chat [agent]="agent" />` wires up message history, streaming output, typing indicator, input, interrupts, tool calls, subagents, citations, and generative UI — all from a single binding.
- **Layered architecture.** Use the opinionated compositions for fast shipping, drop down to individual primitives (30+) to build custom layouts, or mix both.
- **Runtime-neutral.** Compositions consume an `Agent` contract. The library has no hard dependency on LangGraph, AG-UI, or any other backend — swap or combine adapters without touching your UI.
- **A2UI generative UI.** Agents emit structured surface specs; `<a2ui-surface>` renders them as interactive Angular components with a themeable `--a2ui-*` token system.

---

## Install

```bash
npm install @threadplane/chat @threadplane/langgraph marked
```

**Peer dependencies:**

```
@angular/core              ^20.0.0 || ^21.0.0
@angular/common            ^20.0.0 || ^21.0.0
@angular/platform-browser  ^20.0.0 || ^21.0.0
@angular/router            ^20.0.0 || ^21.0.0
@threadplane/licensing     *
@threadplane/render        *
@threadplane/a2ui          *
@json-render/core          ^0.16.0
@langchain/core            ^1.1.33
rxjs                       ~7.8.0
marked                     ^15.0.0 || ^16.0.0
zod                        ^3.25.0
katex                      ^0.16.0 || ^0.17.0 (optional)
```

---

## Quick start

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideChat } from '@threadplane/chat';
import { provideAgent } from '@threadplane/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ apiUrl: '/api/langgraph', assistantId: 'agent' }),
    provideChat({ license: 'eyJ…' }),
  ],
};
```

```typescript
// my.component.ts
import { Component } from '@angular/core';
import { ChatComponent } from '@threadplane/chat';
import { injectAgent } from '@threadplane/langgraph';

@Component({
  selector: 'app-root',
  imports: [ChatComponent],
  template: `<chat [agent]="myAgent" />`,
})
export class AppComponent {
  protected readonly myAgent = injectAgent();
}
```

Get the agent from `@threadplane/langgraph` (for LangGraph Platform backends) or `@threadplane/ag-ui` (for AG-UI-compatible backends). See those packages for setup details.

---

## Capabilities

### Compositions

Ready-to-use full-feature layouts:

| Component | Selector | Description |
|---|---|---|
| `ChatComponent` | `<chat>` | Full-page chat layout; primary entry point |
| `ChatPopupComponent` | `<chat-popup>` | Floating popup with a launcher button |
| `ChatSidebarComponent` | `<chat-sidebar>` | Sidebar-docked layout |
| `ChatSidenavComponent` | `<chat-sidenav>` | Sidenav host with project/thread list panel |
| `ChatTimelineSliderComponent` | `<chat-timeline-slider>` | Time-travel slider for agent checkpoint history |
| `ChatInterruptPanelComponent` | `<chat-interrupt-panel>` | Full interrupt-handling composition |
| `ChatApprovalCardComponent` | `<chat-approval-card>` | Approval/rejection dialog for HITL flows |
| `ChatToolCallCardComponent` | `<chat-tool-call-card>` | Rich card for a single tool call |
| `ChatSubagentCardComponent` | `<chat-subagent-card>` | Rich card for a subagent delegation |

### Primitives

30+ standalone components for custom layouts:

`<chat-message-list>`, `<chat-message>`, `<chat-message-actions>`, `<chat-window>`, `<chat-input>`, `<chat-typing-indicator>`, `<chat-tool-calls>`, `<chat-subagents>`, `<chat-citations>`, `<chat-streaming-md>`, `<chat-trace>`, `<chat-reasoning>`, `<chat-interrupt>`, `<chat-error>`, `<chat-scroll-bubble>`, `<chat-launcher-button>`, `<chat-suggestions>`, `<chat-welcome>`, `<chat-select>`, `<chat-thread-list>`, `<chat-project-list>`, `<chat-timeline>`, `<chat-generative-ui>`, `<chat-genui-skeleton>`, `<chat-overflow-menu>`, `<chat-confirm-dialog>`, `<chat-history-search-palette>`, `<chat-sidenav-scrim>`.

Custom content templates for message bubbles, tool call rows, and citation cards use structural directives: `MessageTemplateDirective`, `ChatToolCallTemplateDirective`, and `ChatCitationCardTemplateDirective`.

### Human-in-the-loop (interrupts)

`<chat-interrupt-panel>` surfaces the current `AgentInterrupt` from an agent and renders approve/reject controls. `<chat-approval-card>` composes as a dialog for explicit approval workflows. Both emit typed action results (`InterruptAction`, `ChatApprovalAction`) that the caller submits back to the agent.

```html
<chat-interrupt-panel
  [agent]="agent"
  (interruptAction)="onAction($event)"
/>
```

### Tool calls and subagents

`<chat-tool-calls>` renders in-progress and completed tool calls. Customize per-call layout with `ChatToolCallTemplateDirective` — the `chatToolCallTemplate` input takes a tool name to match, or `"*"` for all; the template context exposes the `ToolCall` (`$implicit`) and its `status`:

```html
<chat-tool-calls [agent]="agent">
  <ng-template chatToolCallTemplate="*" let-call let-status="status">
    <my-tool-card [call]="call" [status]="status" />
  </ng-template>
</chat-tool-calls>
```

`<chat-subagents>` and `<chat-subagent-card>` track delegated subagent activity with live status.

### Citations

The `Citation` interface provides structured source metadata for assistant messages:

```ts
interface Citation {
  id: string;
  index?: number;     // 1-based display index for inline superscript markers
  title?: string;
  url?: string;
  snippet?: string;
  extra?: unknown;    // adapter-specific fields
}
```

Use `<chat-citations>` to render a collapsible sources panel under assistant messages. Customize the card layout with the `chatCitationCard` template directive:

```html
<chat-citations [message]="message">
  <ng-template chatCitationCard let-citation>
    <a [href]="citation.url">{{ citation.title }}</a>
    <p>{{ citation.snippet }}</p>
  </ng-template>
</chat-citations>
```

Inline citation markers are rendered automatically by `MarkdownCitationReferenceComponent` inside streaming markdown output — superscript indices link to the corresponding card in the sources panel.

`CitationsResolverService` resolves raw `Citation` references into `ResolvedCitation` objects with full source metadata.

**Adapter integration:**
- **LangGraph** — reads from `message.additional_kwargs.citations` (preferred) or `.sources` (fallback).
- **AG-UI** — `bridgeCitationsState` reads `state.citations[messageId]` from the agent state on `STATE_SNAPSHOT` and `STATE_DELTA` events.

### GenUI / A2UI surfaces

`<chat-generative-ui>` renders A2UI surface specs emitted by agents. `<a2ui-surface>` is the underlying host that maps the spec to Angular catalog components (`A2uiButtonComponent`, `A2uiTextFieldComponent`, `A2uiCheckBoxComponent`, etc.).

Agents can emit surface specs via `buildA2uiActionMessage(...)`. Actions from catalog components flow back to the agent as structured messages.

The built-in catalog ships via `a2uiBasicCatalog`. Compose a custom catalog with `withViews()` and pass it to the surface.

**Icons.** The catalog `Icon` component renders [Material Symbols](https://fonts.google.com/icons) by name (the A2UI canonical icon set — e.g. `check`, `trending_up`, `star`). For glyphs to render, include the Material Symbols Outlined stylesheet in your app's `<head>` (the library does not inject any web font):

```html
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
/>
```

Without the font, the icon name falls back to plain text. Icons inherit `currentColor` and size via the `size` prop.

### Streaming markdown

`<chat-streaming-md>` renders markdown token-by-token as the agent streams. The `cacheplaneMarkdownViews` registry maps each CommonMark node type to an Angular component.

Override individual node renderers:

```typescript
import { MARKDOWN_VIEW_REGISTRY, cacheplaneMarkdownViews } from '@threadplane/chat';
import { overrideViews } from '@threadplane/render';
import { MyCodeBlockComponent } from './my-code-block.component';

providers: [
  {
    provide: MARKDOWN_VIEW_REGISTRY,
    useValue: overrideViews(cacheplaneMarkdownViews, { 'code-block': MyCodeBlockComponent }),
  },
];
```

Per-instance, bind the registry on `<chat-streaming-md [viewRegistry]="…" />` instead. Styling uses the existing `--tplane-chat-*` / `--a2ui-*` tokens — see the [Theming](#theming) section.

The `renderMarkdown(md, options?)` function produces a parse tree for use outside streaming contexts.

#### Math (KaTeX)

LaTeX math — inline `$…$` / `\(…\)` and display `$$…$$` / `\[…\]` — renders via [KaTeX](https://katex.org), an **optional** peer dependency loaded lazily only when a message actually contains math (so non-math chats carry zero extra bundle weight). To enable styled math, install `katex` and import its stylesheet once in your app:

```typescript
// e.g. in your global styles or app bootstrap
import 'katex/dist/katex.min.css';
```

Without `katex` installed, or without the stylesheet, math degrades gracefully — the raw `$…$` source is shown rather than breaking. Currency like `$5` is not treated as math.

### Theming

`<a2ui-surface>` declares ~50 `--a2ui-*` CSS custom properties at `:host` with dark-theme defaults covering color, spacing, typography, shape radius, focus ring, motion, and elevation. Catalog components consume them via `var(--a2ui-*)`.

**Built-in presets** — import one in your global stylesheet:

```css
@import '@threadplane/chat/themes/default-dark.css';   /* lib defaults, explicit */
@import '@threadplane/chat/themes/default-light.css';  /* neutral light, blue accent */
@import '@threadplane/chat/themes/material-dark.css';  /* Material Design 3 dark */
@import '@threadplane/chat/themes/material-light.css'; /* Material Design 3 light */
```

Material presets map M3 color tokens to the `--a2ui-*` vocabulary with no `@angular/material` runtime dependency.

**Agent-driven theming.** Agents control two knobs per the A2UI v1 wire format, set via `beginRendering.styles`: `font` (font family string) and `primaryColor` (hex `#RRGGBB`). These flow to `<a2ui-surface>` as inline styles and take precedence over `:root` defaults for that surface.

**Custom themes.** Override any token at `:root`:

```css
:root {
  --a2ui-primary: #FF6B35;
  --a2ui-shape-medium: 4px;
  --a2ui-spacing-3: 16px;
}
```

The full token vocabulary (`--a2ui-primary`, `--a2ui-spacing-1..7`, `--a2ui-typography-*`, `--a2ui-shape-*`, `--a2ui-elevation-*`, etc.) is documented at [threadplane.ai/docs/chat](https://threadplane.ai/docs/chat).

---

## Runtime adapters

Chat compositions consume the runtime-neutral `Agent` contract. Two adapters ship today:

- **`@threadplane/langgraph`** — for LangGraph / LangGraph Platform backends.
- **`@threadplane/ag-ui`** — for AG-UI-compatible backends (LangGraph, CrewAI, Mastra, Microsoft Agent Framework, AG2, Pydantic AI, AWS Strands, CopilotKit runtime).

Custom backends implement the `Agent` (or `AgentWithHistory`) interface directly with no library dependency.

---

## Commercial use

Building a commercial product, SaaS application, internal business tool, agency deliverable, or paid client project with `@threadplane/chat` requires a Threadplane Commercial license.

Free under PolyForm Noncommercial:

- Personal, hobby, student, academic, nonprofit, and public-demo use
- Open-source applications released under an OSI-approved license
- 30 calendar days of commercial evaluation from your first commercial use (good-faith — no tracking, no email required)

See [COMMERCIAL-USE.md](./COMMERCIAL-USE.md) for the definition of commercial use, [LICENSE-COMMERCIAL.md](./LICENSE-COMMERCIAL.md) for the commercial license summary, and the [Threadplane pricing page](https://threadplane.ai/pricing) for plans.

## Using a commercial license

After purchase, Threadplane emails a signed license token to the address on your receipt. The license is valid for 12 months. Pass the token to `provideChat()`:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideChat } from '@threadplane/chat';

export const appConfig: ApplicationConfig = {
  providers: [
    provideChat({
      license: 'eyJ…',  // Token from your purchase email.
    }),
  ],
};
```

The library verifies the token's signature on boot. A missing, expired, or tampered token logs a `console.warn` advisory but does not block rendering — chat continues to work either way. Tokens are validated offline; no calls to Threadplane are made at runtime.

The license string is safe to commit to source control for private repositories, or read from a build-time env var for public ones:

```typescript
declare const THREADPLANE_LICENSE: string | undefined;

providers: [
  provideChat({
    license: typeof THREADPLANE_LICENSE === 'string' ? THREADPLANE_LICENSE : undefined,
  }),
],
```

---

## Reliability

`@threadplane/chat` follows a patch-only release cadence (`0.0.x`). The runtime-neutral `Agent` contract is a stability boundary: adapter updates do not break chat UI code and vice versa. The package is covered by the monorepo's CI lint, test, and build pipeline on every commit.

---

## Documentation

Full API reference, capability matrix, and examples: [threadplane.ai/docs/chat](https://threadplane.ai/docs/chat).

---

## License

`@threadplane/chat` is dual-licensed:

- **Noncommercial use:** [PolyForm Noncommercial License 1.0.0](./LICENSE.md)
- **Commercial use:** [Threadplane Commercial License](./LICENSE-COMMERCIAL.md)

See [COMMERCIAL-USE.md](./COMMERCIAL-USE.md) for the definition of commercial use.
