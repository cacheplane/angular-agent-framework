# LangGraph Subgraphs (Angular)

This capability demonstrates LangGraph subgraph composition — a compiled child
graph added to a parent graph as a plain node — rendered with the
`@threadplane/chat` Angular component library.

The parent orchestrator routes conditionally: requests that need a factual
deep dive enter the `research` child graph first, everything else answers
directly. The child graph's state has no `messages` key, so it exchanges only
`research_topic` and `research_brief` with the parent and never touches the
transcript.

The sidebar shows the child from two angles. `agent.value()` reads the parent
graph's own state — watching the shared keys is watching the boundary itself.
`agent.subagents()` shows the child as a stream: plain subgraph nodes appear
there under their namespace key, named by node, and settle with the run
(tool-dispatched children appear under their tool-call id — see the Chat
Subagents capability for that shape).

Key components used: `<chat>`. Child tokens stay on the child's stream and
never merge into the transcript; `provideAgent({ transcriptNodeNames:
['answer'] })` additionally keeps the top-level router node's
structured-output chunks out of the chat.
