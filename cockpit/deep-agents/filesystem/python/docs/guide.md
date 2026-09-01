# Filesystem with Deep Agents

<Summary>
Render the agent's workspace and gate the writes that matter. `StateBackend` keeps the
agent's files on the graph state under `files`, so a file tree is a `computed()` projection
of live state rather than a replay of `write_file` calls. A `FilesystemPermission` in
`interrupt` mode pauses writes under a chosen prefix for human approval.
</Summary>

<Prompt>
Add a workspace panel beside the `<chat>` component. Read the `files` map off
`injectAgent().value()`, group the paths into directories, and render
`<chat-interrupt-panel>` for the write approvals.
</Prompt>

<Callout type="info" title="Provider setup lives in the LangGraph quickstart">
This guide assumes `provideAgent()` is already configured. If it is not, work through the
[LangGraph quickstart](/docs/langgraph/getting-started/quickstart) first.
</Callout>

<Steps>
<Step title="Choose StateBackend, deliberately">

`create_deep_agent` always installs `FilesystemMiddleware`, so the agent always has
`ls`, `read_file`, `write_file`, and `edit_file`. What decides whether a UI can render the
workspace is the backend. `StateBackend` stores files on the graph state, which means every
write arrives at the client as a `values` update:

```python
from deepagents import create_deep_agent
from deepagents.backends import StateBackend

graph = create_deep_agent(
    model=ChatOpenAI(model="gpt-4.1", temperature=0),
    tools=[lookup_field_elevation, lookup_runway_length],
    system_prompt=(PROMPTS_DIR / "filesystem.md").read_text(),
    backend=StateBackend(),
)
```

A backend that writes anywhere else — a host directory, a remote store — streams nothing
onto the state, and a panel bound to `files` stays empty no matter how busy the agent is.

</Step>
<Step title="Interrupt the writes that leave the desk">

`FilesystemPermission` is a rule over operations and path patterns. In `interrupt` mode a
matching call pauses for approval instead of executing:

```python
from deepagents.middleware import FilesystemPermission

permissions=[
    FilesystemPermission(operations=["write"], paths=["/reports/**"], mode="interrupt"),
]
```

Anchor the pattern with a literal prefix. Bulk tools (`ls`, `glob`, `grep`) decide whether to
fire based on whether their search subtree could overlap the anchored prefix, so a fully
unanchored pattern collapses to `/` and fires on every listing.

</Step>
<Step title="Project the file map into a tree">

`files` is a flat map from absolute path to contents. Split each key on its last slash to get
a directory grouping:

```typescript
protected readonly files = computed<WorkspaceFile[]>(() => {
  const raw = (this.agent.value() as Record<string, unknown> | undefined)?.['files'];
  const entries = new Map<string, string>();
  if (raw && typeof raw === 'object') {
    for (const [path, contents] of Object.entries(raw as Record<string, unknown>)) {
      entries.set(path, typeof contents === 'string' ? contents : JSON.stringify(contents));
    }
  }
  return [...entries.entries()].map(([path, contents]) => {
    const slash = path.lastIndexOf('/');
    return { path, directory: slash > 0 ? path.slice(0, slash) : '/', name: path.slice(slash + 1), contents };
  });
});
```

</Step>
<Step title="Show the pending write before it exists">

The interrupt payload is `{ action_requests: [{ name, args }] }`, and for `write_file` the
target path is `args.file_path`. Reading it off `langGraphInterrupts()` lets the tree show the
file as a ghost row while the approval is open:

```typescript
protected readonly pendingPath = computed<string | null>(() => {
  for (const interrupt of this.agent.langGraphInterrupts() ?? []) {
    const value = (interrupt as { value?: unknown }).value as
      | { action_requests?: Array<{ args?: Record<string, unknown> }> }
      | undefined;
    for (const request of value?.action_requests ?? []) {
      const path = request.args?.['file_path'];
      if (typeof path === 'string') return path;
    }
  }
  return null;
});
```

</Step>
<Step title="Resume with a decisions payload">

`deepagents` expects a structured decision, not a bare string:

```typescript
protected onInterruptAction(action: InterruptAction): void {
  if (action === 'accept') {
    void this.agent.submit({ resume: { decisions: [{ type: 'approve' }] } });
  } else if (action === 'ignore') {
    void this.agent.submit({ resume: { decisions: [{ type: 'reject' }] } });
  }
}
```

Passing a bare list, or a plain string, raises a `TypeError` on the server rather than a
validation error you can see in the browser.

</Step>
</Steps>

<Tip>
The pending row and the approval panel belong in the same sidebar. Reviewing a write is much
easier when the tree already shows where the file is about to land.
</Tip>

<Related>
- [Deep Agents Planning](/deep-agents/core-capabilities/planning/overview/python) — the todo list the agent keeps while it files
- [Chat Interrupts](/chat/core-capabilities/interrupts/overview/python) — the interrupt panel on its own
</Related>
