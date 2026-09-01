# Subagents with Deep Agents

<Summary>
Render real child agents. `SubAgentMiddleware` dispatches through a single `task` tool, and
each dispatch runs as its own graph in a `tools:<call_id>` namespace — so several children
streaming at the same time stay in separate cards. `task` is the SubagentTracker's default
dispatch-tool name, so the Angular side needs no configuration for this to work.
</Summary>

<Prompt>
Render subagent dispatches beside the `<chat>` component: `task` tool calls already register
as subagents, so read `agent.subagents()` for a live dispatch and running count.
</Prompt>

<Callout type="info" title="Provider setup lives in the LangGraph quickstart">
This guide assumes `provideAgent()` is already configured. If it is not, work through the
[LangGraph quickstart](/docs/langgraph/getting-started/quickstart) first.
</Callout>

<Steps>
<Step title="Declare the specialists">

A `SubAgent` is a name, a description the orchestrator reads when choosing, a system prompt,
and the tools that child may use. Giving the orchestrator no lookup tools of its own is what
forces delegation:

```python
from deepagents import SubAgent, create_deep_agent

FIELD_RESEARCHER: SubAgent = {
    "name": "field-researcher",
    "description": "Gathers field elevation and runway length for one airport.",
    "system_prompt": "You research airport field data for a dispatch desk. ...",
    "tools": [lookup_field_elevation, lookup_runway_length],
}

graph = create_deep_agent(
    model=ChatOpenAI(model="gpt-4.1", temperature=0),
    system_prompt=(PROMPTS_DIR / "subagents.md").read_text(),
    subagents=[FIELD_RESEARCHER, WEATHER_ANALYST],
)
```

Passing `subagents` is what installs `SubAgentMiddleware` and, with it, the `task` tool.

</Step>
<Step title="Ask for parallel work explicitly">

The model will serialize dispatches unless told not to. One line in the orchestrator prompt
changes the shape of the run:

```markdown
When a request covers more than one airport or more than one kind of data,
issue every dispatch you need **in a single turn** so the specialists work in
parallel. Do not wait for one to report before sending the next.
```

</Step>
<Step title="Know which tool call means a child started">

`task` is an ordinary tool call on the wire. What makes it render as a child agent is that the
SubagentTracker recognizes the name — and `task` is its default, so a `deepagents` graph needs
no client configuration at all. Naming it explicitly is worth doing anyway, as documentation:

```typescript
provideAgent({
  apiUrl: environment.langGraphApiUrl,
  assistantId: environment.streamingAssistantId,
  // The default. Set it when your dispatch tool is named something else.
  subagentToolNames: ['task'],
});
```

The SubagentTracker registers the dispatch from the tool call — including the `subagent_type`
argument, which becomes the card's name — and then matches the child's `tools:<call_id>`
namespace. Because the dispatch is registered before the child emits its first token,
attribution never depends on message ordering, which is exactly why concurrent children do not
bleed into each other.

</Step>
<Step title="Let the cards render inline, and count them in the sidebar">

The `<chat>` composition renders each dispatch as a `<chat-subagent-card>` in the conversation
and keeps it, collapsed, after completion. A separate active-only tray would duplicate that, so
the sidebar is better spent on something the cards do not show — how wide the fan-out went:

```typescript
private readonly dispatches = computed(() => [...this.agent.subagents().values()]);

protected readonly dispatchCount = computed(() => this.dispatches().length);

protected readonly runningCount = computed(
  () => this.dispatches().filter((subagent) => subagent.status() === 'running').length,
);
```

Note that `status` is itself a signal on the `Subagent` record, so it is called, not read.

</Step>
</Steps>

<Tip>
Give every dispatch a `description` that names its subject and says what you want back. It is
both the child's opening instruction and the label a reader sees on the card, so a vague
description costs twice.
</Tip>

<Related>
- [Deep Agents Planning](/deep-agents/core-capabilities/planning/overview/python) — the orchestrator's own todo list
- [Chat Subagents](/chat/core-capabilities/subagents/overview/python) — the card components on their own
</Related>
