# Generative UI with Streaming Auto-Detection

<Summary>
Render dynamic UI components within chat messages using the streaming
auto-detection pipeline. As tokens stream in, the system detects JSON,
parses it incrementally, and renders Angular components in real time.
</Summary>

<Prompt>
Add generative UI to your chat interface using `views()` from
`@ngaf/chat`. Register view components and pass them to
`ChatComponent` via the `[views]` input.
</Prompt>

<Steps>
<Step title="Define view components">

Create Angular components for each UI type the agent can emit.
Each component uses `input()` signals to receive props from the
rendered spec.

</Step>
<Step title="Register views">

Use the `views()` function to map spec type names to Angular components:

```typescript
import { views } from '@ngaf/chat';

const myViews = views({
  weather_card: WeatherCardComponent,
  stat_card: StatCardComponent,
  container: ContainerComponent,
});
```

</Step>
<Step title="Bind views to ChatComponent">

Pass the view map to `ChatComponent` via the `[views]` input:

```html
<chat [ref]="agentRef" [views]="myViews" />
```

</Step>
<Step title="Configure the agent prompt">

Instruct the LLM to respond with raw JSON following the Spec schema.
No code fences or markdown — just valid JSON so the streaming pipeline
can detect and parse it incrementally.

</Step>
</Steps>

## How Streaming Auto-Detection Works

1. **Token streaming** — The LLM streams response tokens to the client.
2. **ContentClassifier** — Inspects the incoming token buffer and detects
   when the content is JSON rather than plain text or markdown.
3. **Partial JSON parser** — As JSON tokens arrive, a partial parser
   builds an incremental parse tree without waiting for the full payload.
4. **ParseTreeStore** — Materializes the partial parse tree into a live
   `Spec` object (elements map + root key) that updates on every chunk.
5. **Component rendering** — The `[views]` registry resolves each element
   type to an Angular component, which renders incrementally as the spec
   grows.

<Tip>
Because detection and parsing happen on every streamed chunk, the user
sees UI components materialize progressively — cards appear and fill in
as the LLM generates the JSON structure.
</Tip>
