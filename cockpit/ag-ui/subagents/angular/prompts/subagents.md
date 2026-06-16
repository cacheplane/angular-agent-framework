# AG-UI Subagents (Angular)

This capability demonstrates subagent cards over the AG-UI transport using the `@threadplane/chat` Angular component library. An orchestrator agent delegates focused subtasks to specialized subagents by calling a `task` tool; the backend converts each subagent's streamed tokens into native AG-UI ACTIVITY events, and the `@threadplane/ag-ui` reducer projects them onto `agent.subagents()` so the `<chat-subagents>` primitive renders a live card per running subagent.

The example wires the agent (provided by `provideAgent`, retrieved with `injectAgent()`) into the `<chat>` host component. No subagent-specific wiring is needed in the component — `<chat>` renders `<chat-subagents>` automatically once `agent.subagents()` populates.

The demo illustrates the chat-runtime decoupling: the same `<chat>` composition works with any agent runtime - LangGraph, AG-UI, or others - by conforming to the runtime-neutral `Agent` contract from `@threadplane/chat`.
