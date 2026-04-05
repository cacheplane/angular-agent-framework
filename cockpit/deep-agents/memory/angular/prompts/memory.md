# Deep Agents Memory (Angular)

This capability demonstrates how a deep agent stores, retrieves, and updates long-term memories across sessions using the `@cacheplane/chat` Angular component library. The `<chat-debug>` component reveals every memory read and write operation — including the memory key, value, and retrieval score — so developers can verify that the agent is building and using its knowledge store correctly.

Key components used: `<chat-debug>`. Memory tool calls (store_memory, retrieve_memories, delete_memory) appear as collapsible trace nodes, giving full visibility into how the agent's persistent knowledge base evolves over the course of a session and across session boundaries.
