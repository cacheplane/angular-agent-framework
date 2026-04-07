# LangGraph Memory (Angular)

This capability demonstrates cross-thread memory using LangGraph's persistent memory store and the `@cacheplane/chat` Angular component library. Facts and preferences written by the agent in one thread are automatically recalled in subsequent threads, giving the user a coherent long-term experience across sessions.

Key components used: `<chat>` with a thread list sidebar. Each new `agent` ref carries the same `userId` namespace so the LangGraph memory store can surface relevant memories regardless of which thread is active.
