# LangGraph Interrupts (Angular)

This capability demonstrates human-in-the-loop interrupt handling using LangGraph's `interrupt()` primitive and the `@ngaf/chat` Angular component library. When the graph pauses at an interrupt node, the `<chat-interrupt-panel>` surfaces the pending decision to the user; their response is submitted back to the graph via `agent`'s `resume` helper.

Key components used: `<chat>`, `<chat-interrupt-panel>`. The interrupt panel renders inside the chat host and becomes visible automatically whenever the underlying agent detects a pending interrupt in the thread state.
