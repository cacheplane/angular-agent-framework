# Chat Interrupts with @threadplane/chat

<Summary>
Implement human-in-the-loop approval gates using LangGraph interrupts
and ChatInterruptPanelComponent. The graph pauses execution and presents
an approval UI before proceeding.
</Summary>

<Prompt>
Add interrupt handling to your chat interface using `ChatInterruptPanelComponent`
from `@threadplane/chat`. Detect when the stream enters an interrupted state
and render approval/rejection controls.
</Prompt>

<Steps>
<Step title="Configure the agent ref">

Configure `provideAgent()` in your app config, then call `injectAgent()` in your
component - the agent automatically detects interrupt states from the LangGraph
backend:

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
<Step title="Detect interrupt state">

Check the stream status for interrupt events. The agent ref exposes
interrupt data when the graph pauses:

```typescript
protected readonly isInterrupted = computed(
  () => this.stream.status() === 'interrupted'
);
```

</Step>
<Step title="Render the interrupt panel">

Use `ChatInterruptPanelComponent` to display the approval UI:

```html
<chat-interrupt-panel [agent]="stream" />
```

The panel shows the interrupt payload, draft content, and action buttons.

</Step>
<Step title="Handle approval and rejection">

The interrupt panel emits `approve` and `reject` events. Handle them
to resume or cancel the graph execution:

```html
<chat-interrupt-panel
  [agent]="stream"
  (approve)="onApprove()"
  (reject)="onReject()" />
```

</Step>
<Step title="Resume the graph">

After approval, resume the graph to continue from the interrupt point:

```typescript
onApprove() {
  this.stream.resume({ action: 'approve' });
}
```

</Step>
</Steps>

<Tip>
Interrupts are ideal for sensitive actions like sending emails, making
purchases, or modifying data where human oversight is required.
</Tip>
