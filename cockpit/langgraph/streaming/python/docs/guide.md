# Streaming with angular

<Summary>
Build a real-time streaming chat interface using `agent()` from
`@cacheplane/angular` connected to a LangGraph backend on LangSmith Cloud.
</Summary>

<Prompt>
Add real-time LLM streaming to this Angular component using `agent()` from `@cacheplane/angular`. Configure `provideAgent({ apiUrl })` in the app config, then call `stream.submit()` to send messages. Bind `stream.messages()` in the template using `@for` — all Signals, no subscriptions needed.
</Prompt>

<Steps>
<Step title="Configure the provider">

Set up `provideAgent()` in your app config with the LangGraph Cloud URL:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@cacheplane/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({
      apiUrl: 'https://your-deployment.langgraph.app',
    }),
  ],
};
```

This makes the API URL available to all `agent()` calls in your app.

</Step>
<Step title="Create the streaming resource">

In your component, call `agent()` in a field initializer (injection context required):

```typescript
// streaming.component.ts
import { agent } from '@cacheplane/angular';

export class StreamingComponent {
  protected readonly stream = agent({
    assistantId: 'streaming',
  });
}
```

<Note>
`agent()` must be called within an Angular injection context — a component field initializer or constructor body.
</Note>

</Step>
<Step title="Bind the template">

Use Angular's control flow to render messages reactively:

```html
@for (msg of stream.messages(); track $index) {
  <div [class]="'message--' + msg.getType()">
    {{ msg.content }}
  </div>
}
```

The template re-renders automatically as tokens arrive — no manual subscriptions or change detection needed.

</Step>
<Step title="Submit messages">

Call `stream.submit()` with a LangGraph message payload:

```typescript
// streaming.component.ts
send(): void {
  const text = this.prompt().trim();
  if (!text || this.stream.isLoading()) return;
  this.prompt.set('');
  this.stream.submit({
    messages: [{ role: 'human', content: text }],
  });
}
```

The submit call opens a streaming connection to the LangGraph backend. As tokens arrive, `stream.messages()` updates reactively.

</Step>
<Step title="Deploy the LangGraph backend">

The backend is a LangGraph `StateGraph` deployed to LangSmith Cloud:

```python
# graph.py
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI

def build_streaming_graph():
    llm = ChatOpenAI(model="gpt-4o-mini", streaming=True)

    async def generate(state):
        response = await llm.ainvoke(state["messages"])
        return {"messages": [response]}

    graph = StateGraph(dict)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)
    return graph.compile()
```

Deploy with `langgraph deploy` from `langgraph-cli`. The `assistantId` in your Angular code must match the graph name in `langgraph.json`.

</Step>
</Steps>

<Tip>
No service layer needed — `agent()` replaces wrapper services entirely. It handles connection lifecycle, state management, and error recovery.
</Tip>

<Warning>
Never expose your LangSmith API key in client-side code. Use server-side environment variables or a proxy.
</Warning>

<Related>
- [Chat Messages](/chat/core-capabilities/messages/overview/python) — Learn how ChatMessagesComponent renders messages
- [Chat Input](/chat/core-capabilities/input/overview/python) — Explore ChatInputComponent for message submission
</Related>

