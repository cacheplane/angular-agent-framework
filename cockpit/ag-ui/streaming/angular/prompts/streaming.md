# AG-UI Streaming (Angular)

This capability demonstrates real-time token streaming from an AG-UI compatible agent using the `@ngaf/chat` Angular component library. The example shows how to wire the `AG_UI_AGENT` injection token (provided by `provideAgUiAgent`) into the `<chat>` host component and compose `<chat-messages>`, `<chat-input>`, and `<chat-typing-indicator>` to deliver a responsive, streaming chat experience.

Key components used: `<chat>`, `<chat-messages>`, `<chat-input>`, `<chat-typing-indicator>`. The `provideAgUiAgent` provider handles SSE event processing from the AG-UI streaming endpoint, and the chat components subscribe reactively without any manual subscription management.

The demo illustrates the chat-runtime decoupling: the same `<chat>` composition works with any agent runtime — LangGraph, AG-UI, or others — by conforming to the runtime-neutral `Agent` contract from `@ngaf/chat`.
