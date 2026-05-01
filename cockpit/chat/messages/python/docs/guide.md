# Chat Messages with @ngaf/chat

<Summary>
Render chat messages using the primitive components ChatMessagesComponent,
ChatInputComponent, and ChatTypingIndicatorComponent. These building blocks
give full control over message layout, input handling, and loading states.
</Summary>

<Prompt>
Build a chat interface using the individual message primitives from
`@ngaf/chat`. Import `ChatMessagesComponent`, `ChatInputComponent`,
and `ChatTypingIndicatorComponent` separately instead of the composed
`ChatComponent`.
</Prompt>

<Steps>
<Step title="Import the message primitives">

Import the individual chat primitives instead of the composed `ChatComponent`:

```typescript
import {
  ChatMessagesComponent,
  ChatInputComponent,
  ChatTypingIndicatorComponent,
} from '@ngaf/chat';
```

</Step>
<Step title="Render the messages list">

Use `ChatMessagesComponent` to display the conversation history:

```html
<chat-messages [ref]="stream" />
```

The component renders human and AI messages with appropriate styling
and supports streaming token display.

</Step>
<Step title="Add the input and typing indicator">

Place `ChatInputComponent` and `ChatTypingIndicatorComponent` below
the messages:

```html
<chat-typing-indicator [ref]="stream" />
<chat-input [ref]="stream" (send)="submitMessage($event)" />
```

</Step>
<Step title="Handle message submission">

Create a `submitMessage()` method that sends user input to the stream:

```typescript
submitMessage(content: string) {
  this.stream.submit([{ role: 'human', content }]);
}
```

</Step>
<Step title="Customize message templates">

Override default message templates using content projection or custom
renderers for specialized message displays like cards or rich media.

</Step>
</Steps>

<Tip>
Using primitives instead of the composed ChatComponent gives you full
control over layout, spacing, and intermediate UI between messages.
</Tip>
