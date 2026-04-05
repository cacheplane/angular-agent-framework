# Deep Agents Skills (Angular)

This capability demonstrates a deep agent that selects and executes reusable skill modules — pre-packaged sequences of tool calls — using the `@cacheplane/chat` Angular component library. The `<chat-debug>` component shows which skill was invoked, the parameters it received, and the intermediate steps it performed, giving developers full traceability into skill dispatch and execution.

Key components used: `<chat-debug>`. Skill invocations appear as named trace nodes with expandable step-by-step sub-traces, making it easy to audit skill selection logic, identify skill failures, and verify that parameter binding between the agent and each skill is correct.
