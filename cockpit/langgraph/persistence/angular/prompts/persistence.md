# LangGraph Persistence (Angular)

This capability demonstrates persisted conversation threads using LangGraph checkpointers and the `@cacheplane/chat` Angular component library. The `<chat>` component is paired with a thread list so users can switch between saved conversations — each backed by a LangGraph thread ID — without losing history.

Key components used: `<chat>` with a thread list sidebar driven by the LangGraph Threads API. The `streamResource` ref is re-initialised with a new `threadId` whenever the user selects a different thread, and the chat view replays the persisted checkpoint automatically.
