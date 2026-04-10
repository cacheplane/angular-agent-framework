# Chat Subagents with @cacheplane/chat

<Summary>
Track and display subagent orchestration using ChatSubagentsComponent
and ChatSubagentCardComponent. Shows active subagents with their status
as the orchestrator delegates work.
</Summary>

<Prompt>
Add subagent tracking to your chat interface using `ChatSubagentsComponent`
and `ChatSubagentCardComponent` from `@cacheplane/chat`. Display active
subagents with real-time status in a sidebar.
</Prompt>

<Steps>
<Step title="Create the orchestrator graph">

Build a LangGraph with an orchestrator node that delegates to subagent nodes:

```python
graph = StateGraph(MessagesState)
graph.add_node("orchestrator", orchestrator)
graph.add_node("research_agent", research_agent)
graph.add_node("analysis_agent", analysis_agent)
```

</Step>
<Step title="Track subagent status">

Each subagent node emits status updates that the frontend tracks.
The agent ref automatically detects node transitions:

```typescript
protected readonly stream = agent({
  apiUrl: environment.langGraphApiUrl,
  assistantId: environment.streamingAssistantId,
});
```

</Step>
<Step title="Render subagent status">

Use `ChatSubagentsComponent` to display all active subagents:

```html
<chat-subagents [ref]="stream" />
```

</Step>
<Step title="Show individual subagent cards">

Use `ChatSubagentCardComponent` for detailed views of each subagent:

```html
<chat-subagent-card [ref]="stream" />
```

</Step>
<Step title="Handle subagent completion">

Monitor when all subagents complete and the orchestrator produces
the final response. The UI updates automatically as nodes finish.

</Step>
</Steps>

<Tip>
The orchestrator pattern works well for complex tasks that benefit from
specialized processing by domain-specific agents.
</Tip>
