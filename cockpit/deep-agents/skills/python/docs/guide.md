# Multi-Skill Agent with stream-resource

<Summary>
Build a chat interface that shows real-time skill invocations using `streamResource()` from
`@cacheplane/stream-resource`. The agent selects from specialized tools (calculator, word counter,
summarizer) based on the user's request, and the sidebar displays each skill invocation as a card.
</Summary>

<Prompt>
Add a skill invocation sidebar to this Angular component using `streamResource()` from `@cacheplane/stream-resource`. Use `stream.messages()` to access tool call data, derive `skillInvocations` with `computed()`, and bind them to the sidebar via the `<cp-chat>` component from `@cacheplane/chat`.
</Prompt>

<Steps>
<Step title="Configure the provider">

Set up `provideStreamResource()` in your app config with the LangGraph API URL:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideStreamResource } from '@cacheplane/stream-resource';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStreamResource({
      apiUrl: 'https://your-deployment.langgraph.app',
    }),
  ],
};
```

This makes the API URL available to all `streamResource()` calls in your app.

</Step>
<Step title="Create the streaming resource">

In your component, call `streamResource()` with the `assistantId` pointing to your skills graph:

```typescript
// skills.component.ts
import { streamResource } from '@cacheplane/stream-resource';

export class SkillsComponent {
  protected readonly stream = streamResource({
    assistantId: 'skills',
  });
}
```

The resource manages the connection, message history, loading state, and errors automatically.

</Step>
<Step title="Derive skill invocations with computed()">

Use Angular's `computed()` to reactively extract skill invocations from tool calls in `stream.messages()`:

```typescript
import { computed } from '@angular/core';

interface SkillInvocation {
  skillName: string;
  args: string;
  result?: string;
}

export class SkillsComponent {
  protected readonly stream = streamResource({ assistantId: 'skills' });

  skillInvocations = computed(() => {
    const msgs = this.stream.messages();
    const invocations: SkillInvocation[] = [];
    for (const m of msgs) {
      if ((m as any).tool_calls) {
        for (const tc of (m as any).tool_calls) {
          invocations.push({
            skillName: tc.name,
            args: JSON.stringify(tc.args),
            result: tc.output,
          });
        }
      }
    }
    return invocations;
  });
}
```

Each tool call in an AI message maps to a skill invocation card. The `result` field is populated once the tool returns.

<Tip>
`stream.messages()` is a signal. `computed()` recalculates `skillInvocations` automatically whenever new messages arrive — no manual subscription needed.
</Tip>

</Step>
<Step title="Build the template with skill invocation sidebar">

Use the `<cp-chat>` component and project a sidebar via `ng-template`:

```html
<cp-chat
  [messages]="stream.messages()"
  [isLoading]="stream.isLoading()"
  [error]="stream.error()"
  (sendMessage)="send($event)">
  <ng-template #sidebar>
    <h3>Skill Invocations</h3>
    @for (inv of skillInvocations(); track $index) {
      <div>
        <span>{{ inv.skillName }}</span>
        <span>{{ inv.result ? 'done' : 'running…' }}</span>
        <div>{{ inv.args }}</div>
        @if (inv.result) {
          <div>{{ inv.result }}</div>
        }
      </div>
    }
    @empty {
      <p>Ask the agent to calculate, count words, or summarize text.</p>
    }
  </ng-template>
</cp-chat>
```

Each invocation card shows the skill name, input args, and result once available.

</Step>
<Step title="The LangGraph skills backend">

The backend defines three tool skills and uses a tool-calling agent loop with `ToolNode`:

```python
# graph.py
from langchain_core.tools import tool
from langgraph.prebuilt import ToolNode

@tool
def calculator(expression: str) -> str:
    """Evaluate a mathematical expression."""
    return str(eval(expression, {"__builtins__": {}}, {}))

@tool
def word_count(text: str) -> str:
    """Count the number of words in text."""
    return f"{len(text.split())} words"

@tool
def summarize(text: str) -> str:
    """Summarize text in one sentence."""
    sentences = [s.strip() for s in text.split(".") if s.strip()]
    return sentences[0] + "." if sentences else "No content."

# Bind all tools to the LLM
llm = ChatOpenAI(model="gpt-4o-mini").bind_tools([calculator, word_count, summarize])
```

The agent selects which skill to call based on the user's request. `ToolNode` dispatches the call and returns the result as a `ToolMessage`.

<Tip>
The agent loops back after each tool call, allowing it to call multiple skills in a single turn if the user's request requires it (e.g., "count the words in this summary first, then calculate 10% of that number").
</Tip>

</Step>
</Steps>

<Tip>
The `@empty` block in `@for` renders when no skill invocations have occurred yet — a clean way to show a placeholder before the user submits their first request.
</Tip>
