# Chat Timeline with @threadplane/chat

<Summary>
Navigate conversation history using ChatTimelineSliderComponent.
Each exchange creates a checkpoint that users can scrub through,
enabling time-travel debugging and conversation branching.
</Summary>

<Prompt>
Add timeline navigation to your chat interface using
`ChatTimelineSliderComponent` from `@threadplane/chat`. Enable users
to navigate checkpoints and branch from previous conversation states.
</Prompt>

<Steps>
<Step title="Enable history tracking">

History tracking is built into the agent. Each message exchange
creates a checkpoint automatically. Configure `provideAgent()` in your app
config, then call `injectAgent()` in your component:

```typescript
// app.config.ts
import { provideAgent } from '@threadplane/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({
      apiUrl: environment.langGraphApiUrl,
      assistantId: environment.streamingAssistantId,
    }),
  ],
};
```

```typescript
// app.component.ts
import { injectAgent } from '@threadplane/langgraph';

protected readonly stream = injectAgent();
```

</Step>
<Step title="Render the timeline slider">

Use `ChatTimelineSliderComponent` to display a scrubber for
navigating conversation checkpoints:

```html
<chat-timeline-slider [agent]="stream" />
```

</Step>
<Step title="Navigate between checkpoints">

The slider allows users to scrub through conversation history.
Each position corresponds to a graph checkpoint with its full state.

</Step>
<Step title="Display the timeline slider">

Position the slider below the chat or in a sidebar for easy access:

```html
<aside>
  <chat-timeline-slider [agent]="stream" />
</aside>
```

</Step>
<Step title="Branch from a checkpoint">

Users can branch from any checkpoint to explore alternative
conversation paths. The timeline tracks all branches.

</Step>
</Steps>

<Tip>
Timeline navigation is especially useful for debugging agent behavior
and understanding how the conversation state evolved over time.
</Tip>
