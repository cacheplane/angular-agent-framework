# Deep Agents Planning (Angular)

This capability demonstrates how a deep agent decomposes complex tasks into structured plans using the `@cacheplane/chat` Angular component library. The `<chat-debug>` component exposes the agent's internal reasoning trace — goal decomposition, sub-task generation, and dependency resolution — so developers can inspect planning decisions in real time.

Key components used: `<chat-debug>`. The debug panel renders the full agent thought trace alongside the final response, making it easy to understand how the planning agent broke down the user's request and in which order it intends to tackle each sub-task.
