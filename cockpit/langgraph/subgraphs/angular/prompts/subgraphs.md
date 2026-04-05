# LangGraph Subgraphs (Angular)

This capability demonstrates composing LangGraph subgraphs — independent graphs invoked as nodes inside a parent graph — using the `@cacheplane/chat` Angular component library. The `<chat-subagent-card>` renders a live status card for each active subgraph invocation, letting the user see which specialised agent is running and what it has produced.

Key components used: `<chat>`, `<chat-subagent-card>`. Cards appear in the message feed as the parent graph delegates work to subgraphs; each card shows the subgraph name, its streamed output, and a completion badge when the subgraph finishes.
