# Streaming Simulation for Render Examples

**Date:** 2026-04-08
**Status:** Approved

---

## 1. Overview

Replace the static spec-cycling UI in all 6 render cockpit examples with a streaming simulation that demonstrates the partial JSON parser and progressive rendering in real time. Users control playback with a play/pause button, draggable timeline scrubber, and speed controls (1x/2x/4x).

The simulation uses the production `createPartialJsonParser()` and `materialize()` from `libs/partial-json` — no fake behavior. A pre-stringified JSON spec is fed character-by-character through the parser, producing a partial `Spec` object at each position that `RenderSpecComponent` renders progressively.

---

## 2. Architecture

### StreamingSimulator (shared utility)

A plain TypeScript class (no Angular DI required) that encapsulates the streaming engine.

**Input:** JSON string (the spec to stream)

**State signals:**
- `spec: Signal<Spec | null>` — materialized partial spec for RenderSpecComponent
- `rawJson: Signal<string>` — JSON substring up to current position (for sidebar display)
- `position: Signal<number>` — current character index
- `total: Signal<number>` — total characters in source
- `playing: Signal<boolean>` — play/pause state
- `speed: Signal<number>` — playback multiplier (1, 2, or 4)
- `events: Signal<ParseEvent[]>` — accumulated parse events for timeline markers
- `progress: Signal<number>` — computed 0..1 fraction (position / total)

**Actions:**
- `play()` / `pause()` / `toggle()` — control playback
- `seek(position: number)` — scrub to character position. Creates a fresh parser, pushes substring 0..position, materializes. Instant for small specs (<1KB).
- `setSpeed(multiplier: number)` — set playback speed
- `setSource(json: string)` — load new spec, reset position to 0, create fresh parser
- `destroy()` — cancel animation frame loop

**Internal:** A `requestAnimationFrame` loop that advances position by `speed` characters per tick (~60fps) when `playing` is true. Each tick calls `parser.push(nextChars)` and `materialize(parser.root)`.

### StreamingTimelineComponent (shared Angular component)

A standalone Angular component that renders the full-width timeline bar.

**Inputs:**
- `simulator: StreamingSimulator` — the simulator instance to control

**Renders:**
- Play/pause button (circle with play/pause icon)
- Draggable scrubber track with progress fill and handle
- Character counter (`position / total chars`)
- Speed buttons (1x / 2x / 4x)

**Handles:**
- Click play/pause → `simulator.toggle()`
- Drag scrubber → `simulator.seek(position)` based on drag X position
- Click speed → `simulator.setSpeed(n)`

---

## 3. Layout

All 6 render examples share the same layout:

```
┌─────────────────────────────────────────────────────────┐
│  Spec: [Spec 1] [Spec 2] [Spec 3]                      │
├──────────────────────────┬──────────────────────────────┤
│                          │                              │
│   LIVE RENDER OUTPUT     │   STREAMING JSON             │
│                          │                              │
│   Components render      │   Syntax-highlighted JSON    │
│   progressively as       │   with cursor at parse       │
│   JSON tokens arrive.    │   position. Auto-scrolls.    │
│   Skeleton placeholders  │                              │
│   for pending elements.  │                              │
│                          │                              │
├──────────────────────────┴──────────────────────────────┤
│  [▶] ━━━━━━━━●━━━━━━━━━━━━━━━━━━━  142/412 chars [1x]  │
└─────────────────────────────────────────────────────────┘
```

- Left pane: `<render-spec [spec]="simulator.spec()" [store]="store" [loading]="simulator.playing()">`
- Right pane: `<pre>` with `simulator.rawJson()`, cursor indicator at end
- Bottom: `<streaming-timeline [simulator]="simulator">`
- Top: spec picker buttons that call `simulator.setSource(json)` and auto-play

---

## 4. Render Behavior During Streaming

- Elements appear as soon as their `type` field is parsed by the partial JSON parser
- Props fill in progressively (text content grows character by character)
- Pending children show skeleton placeholders with dashed borders
- The `loading` input on RenderSpecComponent propagates to child components
- On completion: timeline pauses, play button shows replay icon

---

## 5. Per-Example Spec Content

Each example has 2-3 pre-defined specs as JSON strings in a `specs.ts` file:

| Example | Spec 1 | Spec 2 | Spec 3 |
|---------|--------|--------|--------|
| spec-rendering | Heading + text | Card + badge + children | Multi-level nested |
| element-rendering | Parent + 2 children (visibility) | 3-level nested tree | Conditional visibility |
| state-management | Form with bound inputs | Nested paths (/user/name) | Computed display |
| registry | 3 registered types | Mixed types | Custom component |
| repeat-loops | List of 3 items | Nested repeat | Dynamic list |
| computed-functions | Date + uppercase | Math operations | String reversal |

Each spec is a valid `@json-render/core` `Spec` with `root` and `elements` fields.

---

## 6. File Structure

```
cockpit/render/
├── shared/
│   ├── streaming-simulator.ts          — StreamingSimulator class
│   ├── streaming-timeline.component.ts — Timeline bar component
│   └── json-highlight.pipe.ts          — Syntax highlighting for JSON sidebar
├── spec-rendering/angular/src/app/
│   ├── spec-rendering.component.ts     — Rewritten with simulator
│   └── specs.ts                        — Pre-defined spec JSON strings
├── element-rendering/angular/src/app/
│   ├── element-rendering.component.ts
│   └── specs.ts
├── state-management/angular/src/app/
│   ├── state-management.component.ts
│   └── specs.ts
├── registry/angular/src/app/
│   ├── registry.component.ts
│   └── specs.ts
├── repeat-loops/angular/src/app/
│   ├── repeat-loops.component.ts
│   └── specs.ts
└── computed-functions/angular/src/app/
    ├── computed-functions.component.ts
    └── specs.ts
```

Shared directory is imported via relative path (e.g., `../../../../shared/streaming-simulator`).

---

## 7. Testing

- Unit test `StreamingSimulator`: verify play advances position, seek re-parses correctly, setSource resets state
- Unit test `StreamingTimelineComponent`: verify play/pause toggle, speed change, scrubber position
- E2e tests per example: verify timeline renders, play button exists, spec picker works
- Smoke tests unchanged (verify module shape)
