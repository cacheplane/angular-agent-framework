# Streaming Generative UI — Docs Update Design Spec

**Date:** 2026-04-08
**Status:** Draft

## Goal

Update the website documentation to reflect the new streaming generative UI capabilities: auto-detection of content type, `@cacheplane/partial-json` parser, `ContentClassifier`, and `ParseTreeStore`. Remove `ChatGenerativeUiComponent` from the public API surface and docs — it's now an internal detail of `ChatComponent`. Fix all stale API references from the rebrand (`createAngularRegistry` → `views()`, `renderRegistry` → `views` input).

## Scope

### Pages to Update

| Page | Path | Changes |
|------|------|---------|
| Chat Introduction | `chat/getting-started/introduction.mdx` | Remove `ChatGenerativeUiComponent` from primitives table, update architecture description |
| Generative UI Guide | `chat/guides/generative-ui.mdx` | Full rewrite — streaming auto-detection is now primary path, manual `ChatGenerativeUiComponent` removed |
| Configuration Guide | `chat/guides/configuration.mdx` | Remove `renderRegistry` from ChatConfig, replace with `views` input on `ChatComponent` |
| ChatConfig API | `chat/api/chat-config.mdx` | Remove `renderRegistry` property, update interface definition |
| provideChat API | `chat/api/provide-chat.mdx` | Remove `renderRegistry` reference |
| ChatComponent | `chat/components/chat.mdx` | Add `views` and `store` inputs documentation, document auto-detection behavior |

### New Pages

| Page | Path | Purpose |
|------|------|---------|
| Streaming Guide | `chat/guides/streaming.mdx` | How content auto-detection works, streaming JSON specs, `ContentClassifier` usage |
| ContentClassifier API | `chat/api/content-classifier.mdx` | `createContentClassifier()` API reference |
| ParseTreeStore API | `chat/api/parse-tree-store.mdx` | `createParseTreeStore()` API reference |

### Config Changes

| File | Changes |
|------|---------|
| `docs-config.ts` | Add "Streaming" guide to chat/guides, add 2 API pages to chat/api |

### Public API Changes

| File | Changes |
|------|---------|
| `libs/chat/src/public-api.ts` | Remove `ChatGenerativeUiComponent` export |

### Landing Page References

| File | Changes |
|------|---------|
| `FairComparisonSection.tsx` | Update `chat-generative-ui` reference to reflect auto-detection |
| `ChatFeaturesSection.tsx` | Update generative UI feature description |

## Content Design

### Generative UI Guide (Rewrite)

The rewritten guide follows this structure:

1. **Intro** — Generative UI lets agents return structured JSON that renders as Angular components. The `ChatComponent` auto-detects JSON specs in AI messages and renders them automatically.

2. **How It Works** — Updated flow diagram:
   ```
   AI message content (token by token)
     → ContentClassifier (auto-detect: markdown vs JSON spec)
       → Markdown path: rendered as prose
       → JSON path: PartialJsonParser → ParseTreeStore → Spec signal
     → ChatComponent template renders both
     → RenderSpecComponent renders specs via view registry
   ```

3. **Setup** — Pass a `ViewRegistry` via the `[views]` input on `ChatComponent`:
   ```typescript
   import { views } from '@cacheplane/chat';

   const myViews = views({
     weather_card: WeatherCardComponent,
     chart: ChartComponent,
   });
   ```
   ```html
   <chat [ref]="agentRef" [views]="myViews" />
   ```

4. **How Auto-Detection Works** — The classifier examines the first non-whitespace character. `{` triggers JSON parsing via `@cacheplane/partial-json`. Everything else is markdown. The detection happens per-message and is stateful.

5. **Creating View Components** — Same pattern as before but using the `views()` helper instead of `createAngularRegistry`.

6. **Loading & Streaming State** — Character-level streaming means components render incrementally. The `loading` input reflects `agentRef.isLoading()`.

7. **State Store** — Optional `[store]` input for interactive specs.

### Streaming Guide (New)

Focused on the streaming infrastructure for advanced users:

1. **Content Classification** — How `ContentClassifier` detects content type, the detection rules, state transitions
2. **Partial JSON Parsing** — `@cacheplane/partial-json` tree-based parser, character-by-character processing, structural sharing
3. **ParseTreeStore** — Bridge from parse tree events to Angular `Spec` signals, `ElementAccumulationState` tracking
4. **Custom Classification** — Using `createContentClassifier()` outside of `ChatComponent` for custom message rendering

### API Reference Pages

**ContentClassifier** — `createContentClassifier()`, `ContentClassifier` interface, `ContentType` union, signal properties (`type`, `markdown`, `spec`, `elementStates`, `streaming`), `update()` method, `dispose()`.

**ParseTreeStore** — `createParseTreeStore()`, `ParseTreeStore` interface, `ElementAccumulationState` interface, signal properties (`spec`, `elementStates`), `push()` method.

## Out of Scope

- `@cacheplane/partial-json` does not get its own docs section (it's an internal library used by the chat streaming infrastructure — not a public API consumers interact with directly)
- A2UI support (future — detection only, no rendering)
- Render lib internal memoization changes (implementation detail, not user-facing)
