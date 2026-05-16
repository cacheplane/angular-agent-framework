# Chat Input with @ngaf/chat

<Summary>
Configure and customize the ChatInputComponent for handling user input
in chat interfaces. Supports keyboard shortcuts, placeholder text,
disabled states, and loading indicators.
</Summary>

<Prompt>
Add a customized chat input to your Angular component using `ChatInputComponent`
from `@ngaf/chat`. Configure placeholder text, keyboard handling,
and loading state integration.
</Prompt>

<Steps>
<Step title="Import ChatInputComponent">

Import the input component from the chat library:

```typescript
import { ChatInputComponent } from '@ngaf/chat';
```

</Step>
<Step title="Configure placeholder text">

Set a custom placeholder via the component input:

```html
<chat-input [agent]="agent" placeholder="Ask me anything..." />
```

</Step>
<Step title="Handle keyboard events">

ChatInputComponent supports Enter to send and Shift+Enter for newlines
out of the box. Listen for the `submitted` event:

```html
<chat-input [agent]="agent" (submitted)="onSubmitted($event)" />
```

</Step>
<Step title="Track loading state">

The send action is disabled while the agent is loading. Access
loading state from the agent:

```typescript
protected readonly isLoading = computed(() => this.agent.isLoading());
```

</Step>
<Step title="Style the input">

Customize input appearance using CSS custom properties:

```css
:root {
  --ngaf-chat-surface: #1a1a2e;
  --ngaf-chat-separator: #333;
  --ngaf-chat-text: #e0e0e0;
  --ngaf-chat-text-muted: #9ca3af;
}
```

</Step>
</Steps>

<Tip>
The input component auto-focuses when the stream completes, keeping the
conversation flow smooth for the user.
</Tip>
