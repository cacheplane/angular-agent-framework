# LangGraph Subgraphs (Angular)

This capability demonstrates LangGraph subgraph composition — a compiled child
graph added to a parent graph as a plain node — rendered with the
`@threadplane/chat` Angular component library.

The parent orchestrator routes conditionally: requests that need a factual
deep dive enter the `research` child graph first, everything else answers
directly. The child graph's state has no `messages` key, so it exchanges only
`research_topic` and `research_brief` with the parent and never touches the
transcript.

The sidebar reads the parent graph's own state through `agent.value()` to show
which branch ran and what the child returned. It deliberately does **not** use
`agent.subagents()`: that signal is populated only by delegation *tool calls*
(`subagentToolNames` + `subagent_type`), not by plain subgraph nodes. For that
pattern see the Chat Subagents capability.

Key components used: `<chat>`. `provideAgent({ transcriptNodeNames: ['answer'] })`
keeps the router's and the subgraph's tokens out of the chat transcript.
