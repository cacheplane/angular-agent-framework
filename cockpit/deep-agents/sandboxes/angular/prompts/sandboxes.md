# Deep Agents Sandboxes (Angular)

This capability demonstrates a deep agent executing code and shell commands inside an isolated sandbox environment using the `@ngaf/chat` Angular component library. The `<chat-debug>` component surfaces every sandbox invocation — the code submitted, the execution environment, stdout/stderr, and exit codes — giving developers complete visibility into agent-driven code execution.

Key components used: `<chat-debug>`. Sandbox execution events appear as trace nodes labelled with the runtime (Python, Node.js, shell, etc.), with expandable panels showing the exact code submitted and the full execution output, making it straightforward to reproduce and debug agent-generated code.
