# Nested Graph Composition with Subgraphs and Angular

<Summary>
Build a chat interface over a LangGraph parent graph that composes a compiled child
graph as a node, using `provideAgent()` and `injectAgent()` from `@threadplane/langgraph`.
The parent orchestrator decides per turn whether to enter the child graph, and the sidebar
reads the parent's own state through `agent.value()` to show which branch ran and what the
child returned.
</Summary>

<Prompt>
Add a parent/child LangGraph composition to this Angular app using `provideAgent()` and `injectAgent()` from `@threadplane/langgraph`. The parent should route conditionally into a compiled child graph whose state has no `messages` key, and the component should read `agent.value()` for the shared `research_topic` / `research_brief` keys. Set `transcriptNodeNames` so only the parent's answer node reaches the chat transcript.
</Prompt>

<Tip>
Every namespaced child run appears in `agent.subagents()`. A subgraph added as a plain
node emits a `research:<uuid>` namespace and registers under that key, named by node —
no configuration needed. Delegation *tool calls* (`subagentToolNames` + `subagent_type`)
appear under their tool-call id instead, carrying the arguments a richer UI can render;
for that pattern see [Chat Subagents](/chat/core-capabilities/subagents/overview/python).
Either way, the child's tokens stay on its stream and never merge into the transcript.
</Tip>

<Steps>
<Step title="Define the typed state and configure the provider">

The parent state carries the transcript plus the keys it shares with the child:

```typescript
// agent-ref.ts
import { createAgentRef } from '@threadplane/chat';

export interface SubgraphsState {
  messages: unknown[];
  research_topic: string;
  research_brief: string;
}

export const SUBGRAPHS_AGENT = createAgentRef<SubgraphsState>('subgraphs');
```

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/langgraph';
import { SUBGRAPHS_AGENT } from './agent-ref';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent(SUBGRAPHS_AGENT, {
      apiUrl: 'https://your-deployment.langgraph.app',
      assistantId: 'subgraphs',
      transcriptNodeNames: ['answer'],
    }),
  ],
};
```

`transcriptNodeNames` whitelists the graph nodes whose message tokens belong in the chat
transcript. It matters more than it looks: a child subgraph's `research:<uuid>` namespace is
not a subagent (`tools:`) namespace, so without this option the child's tokens merge into the
transcript as they stream and its internal brief briefly renders as its own chat bubble. The
parent's final `values` event corrects the message list afterwards, so the symptom is a
mid-stream flash rather than a wrong end state.

</Step>
<Step title="Read the shared state in your component">

`injectAgent(SUBGRAPHS_AGENT)` gives you `LangGraphAgent<SubgraphsState>`, so
`agent.value()` is typed:

```typescript
// subgraphs.component.ts
import { Component, computed } from '@angular/core';
import { injectAgent } from '@threadplane/langgraph';
import { SUBGRAPHS_AGENT } from './agent-ref';

export class SubgraphsComponent {
  protected readonly agent = injectAgent(SUBGRAPHS_AGENT);

  protected readonly topic = computed(() => this.agent.value()?.research_topic ?? '');
  protected readonly brief = computed(() => this.agent.value()?.research_brief ?? '');

  /** A non-empty topic is what the parent's conditional edge routes on. */
  protected readonly delegated = computed(() => this.topic().length > 0);
}
```

`agent.value()` is a `Signal<SubgraphsState>` fed by LangGraph's `values` stream mode. It
updates as the parent graph advances, so the sidebar reflects the branch that actually ran.

</Step>
<Step title="Build the template">

Use `<chat>` from `@threadplane/chat` and render a sibling sidebar off the same signals:

```html
<chat [agent]="agent" />

<aside>
  <h3>Route</h3>
  @if (delegated()) {
    <p>Nested — research subgraph ran</p>
    <code>{{ topic() }}</code>
    <p>{{ brief() }}</p>
  } @else {
    <p>Direct — subgraph skipped</p>
  }
</aside>
```

<Tip>
The brief renders here and nowhere else. Because the child's state has no `messages` key,
its output never enters the transcript — the parent decides what, if anything, to say
about it.
</Tip>

</Step>
<Step title="The LangGraph backend">

The parent adds the *compiled* child graph as a node and routes into it conditionally:

```python
# graph.py
from typing import Annotated, TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

class ResearchState(TypedDict):          # child — no `messages` key
    research_topic: str
    research_brief: str

class OrchestratorState(TypedDict):      # parent — transcript + shared keys
    messages: Annotated[list, add_messages]
    research_topic: str
    research_brief: str

research_graph = StateGraph(ResearchState)
research_graph.add_node("research", research_node)
research_graph.add_edge(START, "research")
research_graph.add_edge("research", END)

def route_after_orchestrate(state: OrchestratorState) -> str:
    return "research" if state.get("research_topic") else "answer"

parent_graph = StateGraph(OrchestratorState)
parent_graph.add_node("orchestrate", orchestrate_node)
parent_graph.add_node("research", research_graph.compile())   # subgraph AS a node
parent_graph.add_node("answer", answer_node)
parent_graph.add_edge(START, "orchestrate")
parent_graph.add_conditional_edges(
    "orchestrate", route_after_orchestrate, {"research": "research", "answer": "answer"}
)
parent_graph.add_edge("research", "answer")
parent_graph.add_edge("answer", END)
graph = parent_graph.compile()
```

LangGraph wires a subgraph node through the keys the two state schemas **share**. Here that
is `research_topic` and `research_brief`: the child receives a topic, returns a brief, and
can neither read nor append to the parent's `messages`. The child runs as its own graph with
its own step sequence, and its stream events arrive under a `research:<uuid>` namespace
rather than flattened into the parent's.

<Tip>
Child subgraphs can have their own state, checkpointers, and tools. Reach for this pattern
when you want a reusable unit of graph logic with a narrow, explicit interface to its caller.
</Tip>

</Step>
</Steps>

<Tip>
The `<chat>` component handles message rendering, input, loading states, and error display.
Focus your component on reading the shared state keys.
</Tip>

<Warning>
Never expose your LangSmith API key in client-side code. Use server-side environment
variables or a proxy.
</Warning>

<Related>
- [Chat Subagents](/chat/core-capabilities/subagents/overview/python) — tool-call delegation, the named-and-argumented flavor of `subagents()`
</Related>
