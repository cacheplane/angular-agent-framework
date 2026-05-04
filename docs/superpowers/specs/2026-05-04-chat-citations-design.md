# `@ngaf/chat@0.0.21` — Citations

**Status:** Approved
**Date:** 2026-05-04
**Target version (synchronized across all @ngaf libs):** `0.0.21`

## 1. Goals & scope

Render citations inline (numbered markers like `[1]`, `[2]`) and as a sources panel under each assistant message. Provider-agnostic — both `@ngaf/langgraph` and `@ngaf/ag-ui` adapters populate the same `Message.citations` shape.

**In scope:**
- `Message.citations?: Citation[]` field + `Citation` interface (in `@ngaf/chat`).
- `<chat-citations>` primitive (sources panel under message).
- Markdown citation-reference view component (inline marker via `chat-md-citation-reference` selector).
- `CitationsResolverService` — DI-injected, signal-backed; merges `Message.citations` + markdown sidecar.
- LangGraph adapter populates from `additional_kwargs.citations` / `additional_kwargs.sources`.
- ag-ui adapter populates from STATE_DELTA at JSON Pointer `/citations/{messageId}`.
- Bump `@cacheplane/partial-markdown` peer in `@ngaf/chat` to `^0.2.0` (the published version with citation AST nodes).
- **Synchronize all 16 @ngaf libraries to `0.0.21`** (per project policy: all @ngaf packages share a single version).

**Out of scope:** global sources sidebar (per-conversation aggregation), citation deduplication across messages, citation export/copy actions, custom citation grouping syntax (`[@a; @b]`), tables and task-list view components in the markdown registry (deferred — citation refs are the only new node type wired in this release; tables/task-lists ship in a later release).

**Hard constraint:** no copilotkit / chatgpt / chatbot-kit / etc. references in code, comments, commits, PR bodies, or docs.

---

## 2. Type surface

### 2.1 New `Citation` interface

```ts
// libs/chat/src/lib/agent/citation.ts
export interface Citation {
  /** Stable id used to match `[^id]` markers in Pandoc-formatted content. */
  id: string;
  /** 1-based display order. Stable per-message. */
  index: number;
  title?: string;
  url?: string;
  snippet?: string;
  /** Provider-specific extras (retrieval score, source type, etc.). */
  extra?: Record<string, unknown>;
}
```

Exported from `@ngaf/chat` public surface. Lives in its own file under `libs/chat/src/lib/agent/`.

### 2.2 `Message.citations` field

```ts
// libs/chat/src/lib/agent/message.ts (modify)
export interface Message {
  // ...existing fields (id, role, content, toolCallId, name, reasoning, reasoningDurationMs, extra)...
  /** Provider-agnostic citation list. Populated by adapters. */
  citations?: Citation[];
}
```

Mirrors the `reasoning` / `extra` optional-adapter-populated pattern.

---

## 3. Components

### 3.1 `MarkdownCitationReferenceComponent`

- Path: `libs/chat/src/lib/markdown/views/markdown-citation-reference.component.ts`
- Selector: `chat-md-citation-reference`
- Registered in `cacheplaneMarkdownViews` for the `'citation-reference'` node type.
- Inputs: receives a `MarkdownCitationReferenceNode` via the render-spec `node` input (per existing markdown view pattern).
- Reads from `CitationsResolverService.lookup(refId)`.
- Rendering:
  - **Resolved** (Citation found via lookup): `<a href="..." class="chat-citation-marker" [title]="snippet || url"><sup>[index]</sup></a>`. `<sup>` for typographic conventions.
  - **Unresolved** (no Citation): `<span class="chat-citation-marker chat-citation-marker--unresolved" title="No source available"><sup>[index]</sup></span>`. Greyed via styles, not interactive.
- Emits no events (markers are reads only).

### 3.2 `ChatCitationsComponent`

- Path: `libs/chat/src/lib/primitives/chat-citations/chat-citations.component.ts`
- Selector: `chat-citations`
- Inputs: `[message]: Message`
- Computed: `citations()` from `message().citations ?? []`, sorted by `index` ascending.
- Renders:
  - Hidden (returns empty template) when `citations()` is empty.
  - Otherwise: header element ("Sources" by default, configurable via `[heading]` input or i18n) + list of cards.
- Slots: ContentChild `<ng-template chatCitationCard let-citation>` for custom card rendering. Default template uses `ChatCitationsCardComponent`.

### 3.3 `ChatCitationsCardComponent`

- Path: `libs/chat/src/lib/primitives/chat-citations/chat-citations-card.component.ts`
- Selector: `chat-citations-card`
- Inputs: `[citation]: Citation`
- Renders: index badge, title (or url if no title), url as href on the title, snippet as small muted text.

### 3.4 Modifications to existing components

- **`ChatMessageComponent`** — render `<chat-citations [message]="message()" />` after the message body slot, before message-actions. Only for assistant messages (`message.role === 'assistant'`).
- **`ChatStreamingMdComponent`** — provide `CitationsResolverService` and feed `markdownDefs.set(...)` from `doc.citations` on each render. Provide a `MESSAGE` injection token (or read `[message]` input — see resolver section) so the resolver can read `Message.citations` for lookups.
- **`cacheplaneMarkdownViews`** — register `MarkdownCitationReferenceComponent` under the `'citation-reference'` key.

---

## 4. CitationsResolverService

```ts
// libs/chat/src/lib/markdown/citations-resolver.service.ts
import { Injectable, computed, signal, type Signal } from '@angular/core';
import type { CitationDefinition } from '@cacheplane/partial-markdown';
import type { Message } from '../agent/message';
import type { Citation } from '../agent/citation';

export interface ResolvedCitation {
  source: 'message' | 'markdown';
  citation: Citation;
}

@Injectable()  // provided per-message in ChatStreamingMdComponent or ChatMessageComponent
export class CitationsResolverService {
  /** Set by host primitive (chat-message) per-message. */
  readonly message = signal<Message | null>(null);
  /** Set by chat-streaming-md from the partial-markdown doc.citations sidecar. */
  readonly markdownDefs = signal<Map<string, CitationDefinition>>(new Map());

  /** Returns a signal that re-evaluates when message or markdownDefs change. */
  lookup(refId: string): Signal<ResolvedCitation | null> {
    return computed(() => {
      const fromMessage = this.message()?.citations?.find(c => c.id === refId);
      if (fromMessage) return { source: 'message', citation: fromMessage };
      const fromMd = this.markdownDefs().get(refId);
      if (fromMd) return { source: 'markdown', citation: mdDefToCitation(fromMd) };
      return null;
    });
  }
}

function mdDefToCitation(def: CitationDefinition): Citation {
  // Walk inline children to extract title + url + snippet.
  // First link/autolink → url; preceding text run → title; remaining → snippet.
  let url: string | undefined;
  const titleParts: string[] = [];
  const remainingParts: string[] = [];
  let phase: 'before-link' | 'after-link' = 'before-link';
  for (const child of def.children) {
    if ((child.type === 'link' || child.type === 'autolink') && url === undefined) {
      url = (child as any).url;
      phase = 'after-link';
      continue;
    }
    const text = inlineToText(child);
    (phase === 'before-link' ? titleParts : remainingParts).push(text);
  }
  const title = titleParts.join('').trim() || undefined;
  const snippet = remainingParts.join('').trim() || undefined;
  return { id: def.id, index: def.index, title, url, snippet };
}

function inlineToText(node: unknown): string {
  // Collapse a markdown inline subtree to plain text.
  // Implementation walks .text on leaf nodes and recurses through container children.
  const n = node as { type: string; text?: string; children?: unknown[]; url?: string };
  if (typeof n.text === 'string') return n.text;
  if (n.type === 'autolink' && typeof n.url === 'string') return n.url;
  if (Array.isArray(n.children)) return n.children.map(inlineToText).join('');
  return '';
}
```

The service is provided **per `chat-streaming-md` instance** (not at the root) — each rendered message has its own resolver. `ChatMessageComponent` provides it and feeds `message()`; `ChatStreamingMdComponent` reads it (via `inject`) and feeds `markdownDefs()`.

---

## 5. Adapter bridges

### 5.1 LangGraph adapter

In `libs/langgraph/src/lib/internals/` (or wherever LangChain BaseMessage → Message conversion happens), add:

```ts
import type { Citation } from '@ngaf/chat';

export function extractCitations(msg: { additional_kwargs?: Record<string, unknown> }): Citation[] | undefined {
  const raw = msg.additional_kwargs?.citations ?? msg.additional_kwargs?.sources;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.map((entry, i) => normalizeCitation(entry, i + 1));
}

function normalizeCitation(entry: unknown, fallbackIndex: number): Citation {
  if (typeof entry === 'string') {
    return { id: `c${fallbackIndex}`, index: fallbackIndex, url: entry };
  }
  const e = (entry ?? {}) as Record<string, unknown>;
  const get = (...keys: string[]): string | undefined => {
    for (const k of keys) if (typeof e[k] === 'string') return e[k] as string;
    return undefined;
  };
  return {
    id: typeof e.id === 'string' ? e.id : (typeof e.refId === 'string' ? e.refId : `c${fallbackIndex}`),
    index: typeof e.index === 'number' ? e.index : fallbackIndex,
    title: get('title', 'name'),
    url: get('url', 'href', 'source'),
    snippet: get('snippet', 'content', 'excerpt'),
    extra: typeof e.extra === 'object' && e.extra !== null ? e.extra as Record<string, unknown> : undefined,
  };
}
```

Wired into the existing LangChain → Message conversion: assigns `result.citations = extractCitations(msg) ?? undefined`. Idempotent across re-runs (same input → same output).

### 5.2 ag-ui adapter

In `libs/ag-ui/src/lib/reducer.ts`, after the existing thread-state JSON-patch application, scan `state.citations` (a `Record<messageId, Citation[]>` at the top of thread state) and merge into matching messages:

```ts
import type { Citation } from '@ngaf/chat';

export function bridgeCitationsState(thread: ThreadState, ngafMessages: Message[]): Message[] {
  const citationsByMsg = (thread.state as { citations?: Record<string, unknown> })?.citations;
  if (!citationsByMsg || typeof citationsByMsg !== 'object') return ngafMessages;
  return ngafMessages.map(msg => {
    const raw = (citationsByMsg as Record<string, unknown>)[msg.id];
    if (!Array.isArray(raw) || raw.length === 0) return msg;
    return { ...msg, citations: raw.map((entry, i) => normalizeCitation(entry, i + 1)) };
  });
}
```

`normalizeCitation` is duplicated in the ag-ui adapter — same shape and tests as the langgraph version. Per project memory ("shared adapter reducer deferred"), the duplication is intentional.

---

## 6. Streaming semantics

- LangGraph adapter re-emits `Message.citations` on every message update from the LangGraph thread.
- ag-ui adapter re-emits whenever STATE_DELTA touches `/citations/{messageId}`.
- `CitationsResolverService` is signal-based; updates flow to inline markers and the sources panel automatically.
- **Mid-stream:** if `[^id]` ref appears in content before the matching citation is in `Message.citations`, marker renders unresolved (greyed). When the citation arrives, marker re-renders as a linked active marker. Identity preserved by Angular's standard signal/OnPush flow.

---

## 7. Synchronized version bump (project policy)

All 16 @ngaf libs bump from their current versions to a unified `0.0.21`:

| Lib | Current | New |
| --- | --- | --- |
| @ngaf/a2ui | 0.0.2 | 0.0.21 |
| @ngaf/ag-ui | 0.0.3 | 0.0.21 |
| @ngaf/chat | 0.0.20 | 0.0.21 |
| @ngaf/cockpit-docs | 0.0.1 | 0.0.21 |
| @ngaf/cockpit-registry | 0.0.1 | 0.0.21 |
| @ngaf/cockpit-shell | 0.0.1 | 0.0.21 |
| @ngaf/cockpit-testing | 0.0.1 | 0.0.21 |
| @ngaf/cockpit-ui | 0.0.1 | 0.0.21 |
| @ngaf/db | 0.0.1 | 0.0.21 |
| @ngaf/design-tokens | 0.0.1 | 0.0.21 |
| @ngaf/example-layouts | 0.0.1 | 0.0.21 |
| @ngaf/langgraph | 0.0.11 | 0.0.21 |
| @ngaf/licensing | 0.0.2 | 0.0.21 |
| @ngaf/partial-json | 0.0.2 | 0.0.21 |
| @ngaf/render | 0.0.2 | 0.0.21 |
| @ngaf/ui-react | 0.0.1 | 0.0.21 |

Inter-package peer/dependency ranges (e.g. `@ngaf/render: "*"` in chat's peerDependencies) stay as `*`/wildcard or are explicitly updated to `^0.0.21` where there's a direct version pin. The `@cacheplane/partial-markdown` peer in chat is bumped to `^0.2.0`.

Tag scheme: a single git tag `ngaf-v0.0.21` at the squash-merge commit. (Per-lib tags like `chat-v0.0.21` deprecated in favor of the unified tag.)

---

## 8. Testing strategy

**Per-feature unit tests:**
- `MarkdownCitationReferenceComponent` — resolved-from-message renders linked, resolved-from-markdown renders linked, unresolved renders greyed. Reactive: lookup result update re-renders.
- `ChatCitationsComponent` — empty/undefined citations hides; sorted by index; ContentChild template slot override; default card template renders title + url + snippet.
- `CitationsResolverService` — lookup precedence (message > markdown), reactivity, `mdDefToCitation` extracts title/url/snippet from inline children.

**Adapter unit tests:**
- `langgraph/extractCitations` — string entry, full-object entry, key-spelling variations (url/href/source, title/name, snippet/content/excerpt), absent kwargs, sources-vs-citations fallback.
- `ag-ui/bridgeCitationsState` — citations Record keyed by messageId merges into matching messages, leaves unmatched messages untouched, idempotent re-run, empty Record passes through.

**Integration tests:**
- End-to-end: assistant message with both Pandoc-formatted defs in content AND structured `Message.citations` — markers resolve from message first, fall back to markdown for unmatched ids.
- Streaming: Message.citations arrives mid-stream; markers flip greyed → active; identity preserved.

---

## 9. Documentation

- `libs/chat/README.md` (or section) — Citations: API, Citation interface, basic usage, custom card slot.
- `libs/langgraph/README.md` — citations sub-section noting `additional_kwargs.citations` / `additional_kwargs.sources` extraction.
- `libs/ag-ui/README.md` — citations sub-section noting the `state.citations[messageId]` STATE_DELTA path.
- Single CHANGELOG entry (root or per-lib, matching existing convention) with `0.0.21` covering citations + the synchronized version bump policy.
