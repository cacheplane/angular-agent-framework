# Generative UI

This example demonstrates streaming generative UI — an LLM returns JSON-render Specs that are auto-detected and rendered as Angular components in real time.

## How It Works

1. The LangGraph agent receives a user message
2. The LLM generates a JSON-render Spec as its response (not markdown)
3. Tokens stream to the Angular frontend via SSE
4. `ChatComponent` auto-detects the JSON via `ContentClassifier`
5. `@cacheplane/partial-json` parses the incomplete JSON character-by-character
6. `ParseTreeStore` materializes the parse tree into a `Spec` signal
7. `RenderSpecComponent` renders the spec using the view registry
8. Components update live as tokens arrive — string props grow visibly

## View Components

This example registers two view components:

- **WeatherCard** — Displays city, temperature, and weather condition
- **StatCard** — Displays a label/value pair (humidity, wind speed, etc.)

## Key Code

```typescript
// Register views
const myViews = views({
  weather_card: WeatherCardComponent,
  stat_card: StatCardComponent,
  container: ContainerComponent,
});

// Pass to ChatComponent
<chat [ref]="agentRef" [views]="myViews" />
```

No manual JSON parsing, no content type detection, no spec wiring — the `ChatComponent` handles everything automatically.
