# Chat Threads with @ngaf/chat

<Summary>
Manage multiple conversation threads using ChatThreadListComponent.
Each thread maintains isolated message history, enabling users to
run parallel conversations with the same agent.
</Summary>

<Prompt>
Add multi-thread support to your chat interface using `ChatThreadListComponent`
from `@ngaf/chat`. Display a thread list sidebar for creating and
switching between conversations.
</Prompt>

<Steps>
<Step title="Configure thread support">

Thread management is built into `agent()`. Each thread gets
a unique ID that persists its conversation state:

```typescript
protected readonly stream = agent({
  apiUrl: environment.langGraphApiUrl,
  assistantId: environment.streamingAssistantId,
});
```

</Step>
<Step title="Render the thread list">

Use `ChatThreadListComponent` in a sidebar to show all threads:

```html
<chat-thread-list [ref]="stream" />
```

</Step>
<Step title="Create new threads">

The thread list component includes a button to create new threads.
Each new thread starts with an empty conversation:

```typescript
createThread() {
  this.stream.createThread();
}
```

</Step>
<Step title="Switch between threads">

Click a thread in the list to switch to it. The chat area updates
to show that thread's message history:

```typescript
switchThread(threadId: string) {
  this.stream.switchThread(threadId);
}
```

</Step>
<Step title="Persist conversations">

Threads are persisted by the LangGraph backend. Reloading the page
restores the thread list and conversation history.

</Step>
</Steps>

<Tip>
Threads are ideal for keeping separate contexts — e.g., one thread
for code review and another for brainstorming.
</Tip>
