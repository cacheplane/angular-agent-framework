# File Operations with angular

<Summary>
Build a chat interface that shows real-time file operation logs using `agent()` from
`@cacheplane/langgraph`. The agent reads and writes files using tool calls, and the
sidebar displays each operation as it happens.
</Summary>

<Prompt>
Add a file operations sidebar to this Angular component using `agent()` from `@cacheplane/langgraph`. Use `stream.messages()` to access tool call data, derive `toolCallEntries` with `computed()`, and bind them to the sidebar via the `<cp-chat>` component from `@cacheplane/chat`.
</Prompt>

<Steps>
<Step title="Configure the provider">

Set up `provideAgent()` in your app config with the LangGraph API URL:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@cacheplane/langgraph';

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

In your component, call `agent()` with the `assistantId` pointing to your filesystem graph:

```typescript
// filesystem.component.ts
import { agent } from '@cacheplane/langgraph';

export class FilesystemComponent {
  protected readonly stream = agent({
    assistantId: 'filesystem',
  });
}
```

The resource manages the connection, message history, loading state, and errors automatically.

</Step>
<Step title="Derive tool call entries with computed()">

Use Angular's `computed()` to reactively extract tool calls from `stream.messages()`:

```typescript
import { computed } from '@angular/core';

interface ToolCallEntry {
  name: string;
  args: string;
  result?: string;
}

export class FilesystemComponent {
  protected readonly stream = agent({ assistantId: 'filesystem' });

  toolCallEntries = computed(() => {
    const msg = this.stream.messages();
    const calls: ToolCallEntry[] = [];
    for (const m of msg) {
      if ((m as any).tool_calls) {
        for (const tc of (m as any).tool_calls) {
          calls.push({ name: tc.name, args: JSON.stringify(tc.args), result: tc.output });
        }
      }
    }
    return calls;
  });
}
```

`stream.messages()` is a signal that updates as messages arrive. `computed()` re-derives the tool call list automatically whenever new messages come in.

<Tip>
Tool calls appear inside AI messages as `tool_calls`. Each entry has a `name` (e.g. `read_file`), `args` (the tool inputs), and `output` (the tool result, populated after the tool runs).
</Tip>

</Step>
<Step title="Build the template with file operations sidebar">

Use the `<cp-chat>` component and project a sidebar via `ng-template`:

```html
<cp-chat
  [messages]="stream.messages()"
  [isLoading]="stream.isLoading()"
  [error]="stream.error()"
  (sendMessage)="send($event)">
  <ng-template #sidebar>
    <h3>File Operations</h3>
    @for (entry of toolCallEntries(); track $index) {
      <div>
        <span>{{ entry.name === 'read_file' ? '📖' : '✏️' }}</span>
        <div>
          <div>{{ getFilePath(entry.args) }}</div>
          <div>{{ entry.name === 'read_file' ? 'read' : 'write' }}{{ entry.result ? ' · done' : ' · running…' }}</div>
        </div>
      </div>
    }
    @empty {
      <p>Ask the agent to read or write a file.</p>
    }
  </ng-template>
</cp-chat>
```

The `#sidebar` template is projected into the chat layout. Operations render reactively as the agent calls tools.

</Step>
<Step title="The LangGraph filesystem backend">

The backend uses a tool-calling agent loop with `read_file` and `write_file` tools:

```python
# graph.py
from langchain_core.tools import tool
from langgraph.prebuilt import ToolNode

@tool
def read_file(path: str) -> str:
    """Read a file's contents. Only reads from the workspace directory."""
    return f"Contents of {path}: [simulated file content]"

@tool
def write_file(path: str, content: str) -> str:
    """Write content to a file in the workspace."""
    return f"Successfully wrote {len(content)} bytes to {path}"

# Bind tools to the LLM
llm = ChatOpenAI(model="gpt-4o-mini").bind_tools([read_file, write_file])
```

The agent node invokes the LLM, which may emit tool calls. A conditional edge routes to the `ToolNode` when tool calls are present, then loops back to the agent. The frontend sees each tool call in `stream.messages()`.

<Tip>
`ToolNode` from `langgraph.prebuilt` handles dispatching tool calls to the right function and returning results as `ToolMessage` nodes automatically.
</Tip>

</Step>
</Steps>

<Tip>
The `@empty` block in `@for` renders when no tool calls have been made yet — a clean way to show a placeholder before the user submits their first request.
</Tip>
