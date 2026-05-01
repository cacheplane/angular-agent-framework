# LangGraph Durable Execution (Angular)

This capability demonstrates LangGraph's durable execution guarantees — automatic retry, reconnection, and resumption after network interruptions — using the `@ngaf/chat` Angular component library. The `<chat-error>` component surfaces transient failures with a one-click reconnect affordance, while `agent` handles exponential back-off and checkpoint-based resumption transparently.

Key components used: `<chat>`, `<chat-error>`. When the SSE stream is interrupted, `<chat-error>` replaces the typing indicator with an error banner; once the user reconnects (or `agent` auto-retries), the component dismisses automatically and the stream resumes from the last persisted checkpoint.
