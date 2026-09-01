# Planning with Deep Agents

<Summary>
Render the live todo list a `deepagents` agent keeps while it works. `TodoListMiddleware`
gives the model a `write_todos` tool and puts a `todos` array on the graph state; the Angular
panel is a `computed()` projection of that array, so rows move from pending to in progress to
completed as the agent works, and the list changes shape when the agent revises its plan.
</Summary>

<Prompt>
Add a live plan panel beside the `<chat>` component. Read `todos` off `injectAgent().value()`,
where each entry is `{ content, status }` with status one of `pending`, `in_progress`, or
`completed`, and render one row per todo with a status icon.
</Prompt>

<Callout type="info" title="Provider setup lives in the LangGraph quickstart">
This guide assumes `provideAgent()` is already configured. If it is not, work through the
[LangGraph quickstart](/docs/langgraph/getting-started/quickstart) first — every Deep Agents
capability uses the same provider, the same `injectAgent()` call, and the same `<chat>`
composition.
</Callout>

<Steps>
<Step title="Build the agent on TodoListMiddleware">

`create_deep_agent` assembles a LangGraph agent from middleware. `TodoListMiddleware` is the
one that matters here: it registers the `write_todos` tool and declares the `todos` key on the
state schema.

```python
# src/graph.py
from deepagents import create_deep_agent
from langchain.agents.middleware import TodoListMiddleware
from langchain_openai import ChatOpenAI

graph = create_deep_agent(
    model=ChatOpenAI(model="gpt-4.1", temperature=0),
    tools=[lookup_field_elevation, lookup_runway_length, lookup_weather],
    system_prompt=(PROMPTS_DIR / "planning.md").read_text(),
    middleware=[TodoListMiddleware()],
)
```

The middleware is listed explicitly rather than left to the `create_deep_agent` defaults, so
the source says which component owns `todos`.

</Step>
<Step title="Tell the model to plan first">

`TodoListMiddleware` supplies the model with a tool, not with a policy. Without instruction the
model will happily fan out six parallel lookups and never write a todo. The system prompt is
what makes the plan visible:

```markdown
Your first action on any request is a call to `write_todos`. Do not call a
lookup tool before the todo list exists. Write one todo per step.

Mark exactly one todo `in_progress` before you start it and mark it `completed`
the moment it is done. Call `write_todos` again for each transition.
```

Each `write_todos` call replaces the entire list. There is no partial update, so the panel never
has to reconcile anything.

</Step>
<Step title="Project the todos into a signal">

`injectAgent().value()` is the latest graph state. Derive the rows with `computed()` and
normalize the status, because a state key is not a typed contract:

```typescript
// planning.component.ts
interface Todo {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

protected readonly agent = injectAgent();

protected readonly todos = computed<Todo[]>(() => {
  const todos = (this.agent.value() as Record<string, unknown> | undefined)?.['todos'];
  if (!Array.isArray(todos)) return [];
  return todos.map((todo) => {
    const entry = todo as Record<string, unknown>;
    const status = entry['status'] as Todo['status'];
    return {
      content: String(entry['content'] ?? ''),
      status: TODO_STATUSES.includes(status) ? status : 'pending',
    };
  });
});
```

</Step>
<Step title="Render the panel">

A todo carries no identifier, so track by index rather than by content — the content of a row
can change when the agent rewrites a step.

```html
<example-chat-layout sidebarWidth="20rem">
  <chat main [agent]="agent" class="flex-1 min-w-0" />
  <div sidebar class="panel">
    <h3 class="cap">Plan</h3>
    @if (todos().length === 0) {
      <p class="empty">No plan yet</p>
    }
    @for (todo of todos(); track $index) {
      <div class="todo" [attr.data-status]="todo.status">
        <span class="todo__text">{{ todo.content }}</span>
      </div>
    }
  </div>
</example-chat-layout>
```

Styling off `[attr.data-status]` keeps the status mapping in CSS instead of spreading a second
copy of the enum through the template.

</Step>
</Steps>

<Tip>
The shape of a todo in `deepagents` 0.7.11 is exactly `{ content, status }`. There is no `id`
and no separate present-tense label, so do not build a panel that depends on one.
</Tip>

<Related>
- [Deep Agents Subagents](/deep-agents/core-capabilities/subagents/overview/python) — the same agent delegating work to child agents
- [Deep Agents Filesystem](/deep-agents/core-capabilities/filesystem/overview/python) — the file tree the agent writes into while it works
</Related>
