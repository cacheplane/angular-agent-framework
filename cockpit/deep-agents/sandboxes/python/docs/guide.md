# Code Execution Sandbox with angular

<Summary>
Build a chat interface that shows real-time code execution logs using `agent()` from
`@ngaf/langgraph`. The agent writes Python code and runs it in a sandbox, and the
sidebar displays each execution as a log entry with code input, stdout output, and exit status.
</Summary>

<Prompt>
Add a code execution log sidebar to this Angular component using `agent()` from `@ngaf/langgraph`. Use `stream.messages()` to access tool call data from the `run_code` tool, derive `executionLogs` with `computed()`, and bind them to the sidebar via the `<cp-chat>` component from `@ngaf/chat`.
</Prompt>

<Steps>
<Step title="Configure the provider">

Set up `provideAgent()` in your app config with the LangGraph API URL:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@ngaf/langgraph';

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

In your component, call `agent()` with the `assistantId` pointing to your sandboxes graph:

```typescript
// sandboxes.component.ts
import { agent } from '@ngaf/langgraph';

export class SandboxesComponent {
  protected readonly stream = agent({
    assistantId: 'sandboxes',
  });
}
```

The resource manages the connection, message history, loading state, and errors automatically.

</Step>
<Step title="Derive execution logs with computed()">

Use Angular's `computed()` to extract execution log entries from `run_code` tool calls in `stream.messages()`:

```typescript
import { computed } from '@angular/core';

interface ExecutionLog {
  code: string;
  stdout: string;
  exitStatus: number;
}

export class SandboxesComponent {
  protected readonly stream = agent({ assistantId: 'sandboxes' });

  executionLogs = computed(() => {
    const msgs = this.stream.messages();
    const logs: ExecutionLog[] = [];
    for (const m of msgs) {
      if ((m as any).tool_calls) {
        for (const tc of (m as any).tool_calls) {
          if (tc.name === 'run_code' && tc.output) {
            const parsed = JSON.parse(tc.output);
            logs.push({
              code: tc.args?.code ?? '',
              stdout: parsed.stdout ?? '',
              exitStatus: parsed.exit_status ?? 0,
            });
          }
        }
      }
    }
    return logs;
  });
}
```

Each `run_code` call becomes a log entry. The `output` field contains a JSON-encoded result with `stdout`, `stderr`, and `exit_status`.

<Tip>
The tool result (`tc.output`) is populated after the tool finishes executing. Before that, the entry has no result yet — useful for showing a "running" state.
</Tip>

</Step>
<Step title="Build the template with execution log sidebar">

Use the `<cp-chat>` component and project a sidebar via `ng-template`:

```html
<cp-chat
  [messages]="stream.messages()"
  [isLoading]="stream.isLoading()"
  [error]="stream.error()"
  (sendMessage)="send($event)">
  <ng-template #sidebar>
    <h3>Execution Logs</h3>
    @for (log of executionLogs(); track $index) {
      <div>
        <span [style.background]="log.exitStatus === 0 ? '#d1fae5' : '#fee2e2'">
          exit {{ log.exitStatus }}
        </span>
        <pre>{{ log.code }}</pre>
        @if (log.stdout) {
          <div>stdout</div>
          <pre>{{ log.stdout }}</pre>
        }
      </div>
    }
    @empty {
      <p>Ask the agent to write and run Python code.</p>
    }
  </ng-template>
</cp-chat>
```

Each log entry shows the code that was executed, the exit status badge, and the stdout output.

</Step>
<Step title="The LangGraph sandboxes backend">

The backend defines a `run_code` tool that simulates Python execution and uses a tool-calling loop:

```python
# graph.py
import json
from langchain_core.tools import tool
from langgraph.prebuilt import ToolNode

@tool
def run_code(code: str) -> str:
    """Execute a Python code snippet in a sandbox.

    Returns a JSON object with stdout, stderr, and exit_status.
    """
    # In demo mode, simulates print() calls and checks syntax
    stdout = simulate_execution(code)
    return json.dumps({
        "stdout": stdout,
        "stderr": "",
        "exit_status": 0,
    })

llm = ChatOpenAI(model="gpt-4o-mini").bind_tools([run_code])
tool_node = ToolNode([run_code])
```

The agent writes code, calls `run_code`, receives the JSON result, and uses the output to formulate its answer. The frontend parses the JSON to populate the execution log sidebar.

<Tip>
In production, replace the simulated execution with a real sandboxed runner (e.g., a Docker container, AWS Lambda, or E2B). The frontend component doesn't change — only the tool implementation.
</Tip>

</Step>
</Steps>

<Tip>
The `@empty` block in `@for` renders when no code has been executed yet — a clean placeholder before the user submits their first coding request.
</Tip>
