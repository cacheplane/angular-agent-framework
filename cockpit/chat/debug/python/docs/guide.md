# Chat Debug with @cacheplane/chat

<Summary>
Inspect conversation state, diffs, and graph execution using the
ChatDebugComponent. Provides a full debug panel with timeline,
state inspector, and diff viewer for development.
</Summary>

<Prompt>
Add a debug panel to your chat interface using `ChatDebugComponent`
from `@cacheplane/chat`. This replaces `ChatComponent` and provides
full development inspection capabilities.
</Prompt>

<Steps>
<Step title="Import ChatDebugComponent">

Use `ChatDebugComponent` instead of `ChatComponent` for the full
debug experience:

```typescript
import { ChatDebugComponent } from '@cacheplane/chat';
```

</Step>
<Step title="Configure the debug panel">

Place the debug component in your template:

```html
<chat-debug [ref]="stream" />
```

This renders the full debug panel with timeline, state inspector,
and diff viewer.

</Step>
<Step title="Inspect graph state">

The debug panel shows the current graph state at each checkpoint.
Click on any checkpoint to see the full state object and how it
changed from the previous step.

</Step>
<Step title="View state diffs">

The diff viewer highlights what changed between consecutive
checkpoints, making it easy to understand how each node modifies
the conversation state.

</Step>
<Step title="Use debug controls">

The debug panel provides controls for stepping through execution,
replaying from checkpoints, and inspecting intermediate values.

</Step>
</Steps>

<Tip>
ChatDebugComponent is designed for development only. Use ChatComponent
in production for a polished end-user experience.
</Tip>
