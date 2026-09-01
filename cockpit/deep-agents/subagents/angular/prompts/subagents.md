# Deep Agents Subagents (Angular)

This capability renders real child agents. `SubAgentMiddleware` gives the orchestrator a `task` tool taking `{ description, subagent_type }`, and each dispatch runs as its own graph in a `tools:<call_id>` namespace. Attribution is therefore structural rather than inferred: the SubagentTracker matches namespaces, so four children streaming at once land in four separate `<chat-subagent-card>` elements instead of interleaving into one.

`task` is the SubagentTracker's default dispatch-tool name, so a `deepagents` graph needs no client configuration for the cards to appear; `provideAgent()` names it explicitly as documentation. The sidebar reads `agent.subagents()` for a live dispatch and running count.
