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
<chat-input [ref]="stream" placeholder="Ask me anything..." />
```

</Step>
<Step title="Handle keyboard events">

ChatInputComponent supports Enter to send and Shift+Enter for newlines
out of the box. Listen for the `send` event:

```html
<chat-input [ref]="stream" (send)="onSend($event)" />
```

</Step>
<Step title="Track loading state">

The input automatically disables while the stream is active. Access
loading state via the agent ref:

```typescript
protected readonly isLoading = computed(() => this.stream.status() === 'streaming');
```

</Step>
<Step title="Style the input">

Customize input appearance using CSS custom properties:

```css
chat-input {
  --chat-input-bg: #1a1a2e;
  --chat-input-border: #333;
  --chat-input-text: #e0e0e0;
}
```

</Step>
</Steps>

<Tip>
The input component auto-focuses when the stream completes, keeping the
conversation flow smooth for the user.
</Tip>
