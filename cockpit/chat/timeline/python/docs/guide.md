# Chat Timeline with @cacheplane/chat

<Summary>
Navigate conversation history using ChatTimelineSliderComponent.
Each exchange creates a checkpoint that users can scrub through,
enabling time-travel debugging and conversation branching.
</Summary>

<Prompt>
Add timeline navigation to your chat interface using
`ChatTimelineSliderComponent` from `@cacheplane/chat`. Enable users
to navigate checkpoints and branch from previous conversation states.
</Prompt>

<Steps>
<Step title="Enable history tracking">

History tracking is built into `streamResource()`. Each message exchange
creates a checkpoint automatically:

```typescript
protected readonly stream = streamResource({
  apiUrl: environment.langGraphApiUrl,
  assistantId: environment.streamingAssistantId,
});
```

</Step>
<Step title="Render the timeline slider">

Use `ChatTimelineSliderComponent` to display a scrubber for
navigating conversation checkpoints:

```html
<chat-timeline-slider [ref]="stream" />
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
  <chat-timeline-slider [ref]="stream" />
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
