# Deep Agents Filesystem (Angular)

This capability demonstrates a deep agent that reads, writes, and navigates a sandboxed filesystem using the `@ngaf/chat` Angular component library. The `<chat-debug>` component surfaces every filesystem tool call — including path, arguments, and result — so developers can follow the agent's file operations step by step.

Key components used: `<chat-debug>`. Each tool invocation (read_file, write_file, list_dir, etc.) appears as a collapsible trace node, giving full visibility into how the agent interacts with the filesystem without cluttering the end-user chat view.
