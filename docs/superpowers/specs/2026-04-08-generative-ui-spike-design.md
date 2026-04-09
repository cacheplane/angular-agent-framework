# Generative UI Spike — Design Spec

**Date:** 2026-04-08
**Status:** Draft

## Goal

Prove the streaming generative UI pipeline end-to-end: LangGraph agent returns a JSON-render Spec as AI message content → tokens stream → `ContentClassifier` auto-detects JSON → `PartialJsonParser` builds tree → `ParseTreeStore` materializes Spec → `<render-spec>` renders Angular components that update live as tokens arrive.

## Approach

Add a new cockpit capability under `cockpit/langgraph/generative-ui/` following the existing capability pattern. The agent returns a full JSON-render Spec as its message content (not as a tool call result). The Angular frontend uses `ChatComponent` with `[views]` input — relying entirely on auto-detection.

## Python Graph

A single-node LangGraph graph (`MessagesState`). The node calls an LLM with a system prompt that instructs it to respond with a JSON-render Spec containing 2-3 elements: a `WeatherCard` and one or two `StatCard` components. The LLM streams the JSON token-by-token.

The system prompt includes the exact Spec schema and available component types so the LLM knows what to generate.

## Angular Frontend

### View Components

**WeatherCard** — Displays city name, temperature, condition, and an icon. Inputs: `city: string`, `temperature: number`, `condition: string`.

**StatCard** — Displays a label and value (e.g., "Humidity: 65%"). Inputs: `label: string`, `value: string`.

Both are simple standalone components with Tailwind styling.

### App Component

Uses `ChatComponent` with `[views]` input passing a `ViewRegistry` mapping `weather_card` → `WeatherCardComponent` and `stat_card` → `StatCardComponent`.

## Registration

- Add `generative-ui` topic to the `langgraph` product's `core-capabilities` section in the cockpit manifest
- Create module metadata (`CockpitCapabilityModule`) in the Python `src/index.ts`
- Register in `route-resolution.ts`'s `capabilityModules` array

## What It Proves

1. The parse tree correctly builds from character-by-character LLM output
2. Materialization produces valid `Spec` objects that `<render-spec>` can render
3. Structural sharing works — unchanged elements keep references, render lib skips re-render
4. Character-level prop streaming is visible in the rendered UI (e.g., city name filling in letter by letter)
5. The full pipeline works without any manual wiring — just `[views]` input on `ChatComponent`

## What It Defers

- Real-world data (Phase 2: analytics dashboard with charts, data grids, tool calling)
- A2UI support
- Production error handling for malformed JSON
- Interactive state store integration
