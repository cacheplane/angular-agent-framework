# Deep Agents Subagents (Angular)

This capability demonstrates an orchestrator agent that delegates work to specialised subagents using the `@cacheplane/chat` Angular component library. The `<chat-debug>` component shows the full delegation trace — which subagent was called, with what instructions, and what it returned — giving developers complete observability into multi-agent coordination.

Key components used: `<chat-debug>`. Each subagent invocation appears as a collapsible trace node labelled with the subagent's identity, making it straightforward to audit delegation chains, spot redundant calls, and verify that each subagent received the correct context.
