# Memory with Deep Agents

<Summary>
Give an agent a memory file it maintains itself, keep that file in LangGraph's store so it
outlives the thread, and render it. The interesting part is reading it back:
`memory_contents` is annotated `PrivateStateAttr`, so it never appears in the `values` stream
and needs a deliberate channel.
</Summary>

<Prompt>
Add an agent-memory panel beside the `<chat>` component. Read `memory_contents` from
`agent.customEvents()` for the live view and from `agent.value()` for a reopened thread, and
render each remembered line.
</Prompt>

<Callout type="info" title="Provider setup lives in the LangGraph quickstart">
This guide assumes `provideAgent()` is already configured. If it is not, work through the
[LangGraph quickstart](/docs/langgraph/getting-started/quickstart) first.
</Callout>

<Steps>
<Step title="Point memory at a store, not at the thread">

`memory=[...]` installs `MemoryMiddleware`, which loads those files into the system prompt on
every turn and instructs the model to keep them current with `edit_file`. The backend decides
how long that survives:

```python
from deepagents import create_deep_agent
from deepagents.backends import StoreBackend

MEMORY_NAMESPACE = ("cockpit", "deep-agents-memory")

graph = create_deep_agent(
    model=ChatOpenAI(model="gpt-4.1", temperature=0),
    system_prompt=(PROMPTS_DIR / "memory.md").read_text(),
    backend=StoreBackend(namespace=lambda _runtime: MEMORY_NAMESPACE),
    memory=["/memories/AGENTS.md"],
)
```

`StoreBackend` writes into LangGraph's `BaseStore`, which is shared across threads;
`StateBackend` would put the file on the thread's own state, where a new conversation would
never see it. `store=None` means "resolve the store from the graph execution context", which
the LangGraph server supplies. Scope the namespace per user in anything real — a fixed tuple
means every visitor shares one memory.

</Step>
<Step title="Let the agent decide what to remember">

Nothing in the application parses the conversation for facts. The system prompt is the policy:

```markdown
`/memories/AGENTS.md` is yours. It is loaded into your context at the start of
every conversation, including conversations you have not had yet.

Write to it with `edit_file` whenever the user tells you something durable:
a home base, a fleet type, a standing preference, a correction.

Do not record one-off requests, small talk, or anything stale next week.
Never record credentials of any kind.
```

The last line matters. A memory file is a persistent, model-writable document, so say plainly
what must never go in it.

</Step>
<Step title="Republish the private key as a custom event">

`MemoryMiddleware` annotates `memory_contents` with `PrivateStateAttr`. That keeps it out of
the `values` stream — correct for a transcript, and the reason a panel bound to
`agent.value()` shows nothing while the agent is working. A small middleware announces it on a
channel the client does receive:

```python
class MemoryVisibilityMiddleware(AgentMiddleware):
    def _emit(self, state):
        contents = state.get("memory_contents")
        if contents is None:
            return
        try:
            writer = get_stream_writer()
        except (RuntimeError, KeyError):
            return
        writer({"name": MEMORY_EVENT, "data": {"memory_contents": contents}})

    def after_model(self, state, runtime):
        self._emit(state)
        return None
```

This is an application-side shim, not a framework change: the key stays private on the state
and is simply announced alongside it.

</Step>
<Step title="Read both sources, and know which one you are on">

A custom event is a live signal — it is not replayed when a thread is reopened. The key IS
written to the checkpoint, though, and `@threadplane/langgraph` projects the latest checkpoint
into `value()` when a run completes. So there are two sources, and it is worth telling them
apart:

```typescript
protected readonly memorySource = computed<'live' | 'checkpoint' | 'none'>(() => {
  const live = this.liveMemory();
  if (live && Object.keys(live).length > 0) return 'live';
  return this.settledMemory() ? 'checkpoint' : 'none';
});
```

Without the middleware the panel still fills in, just a beat later and only at settle. With it,
the panel updates while the agent is still writing.

</Step>
</Steps>

<Tip>
Test cross-thread memory by starting a genuinely new thread, not by clearing the panel. A
reload that creates a new thread and still shows the file is the only assertion that proves the
store, rather than the component, is doing the remembering.
</Tip>

<Related>
- [Deep Agents Skills](/deep-agents/core-capabilities/skills/overview/python) — the same private-state visibility problem, for `skills_metadata`
- [Deep Agents Filesystem](/deep-agents/core-capabilities/filesystem/overview/python) — the state-backed workspace that does stream
</Related>
