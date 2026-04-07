Add thread persistence to my Angular component that uses angular, so conversations survive page refresh.

1. On component init, read the stored thread ID: const storedId = localStorage.getItem('chat-thread-id').

2. Create a signal: threadId = signal<string | null>(storedId).

3. Pass it to agent: agent({ ..., threadId: this.threadId, onThreadId: (id) => { this.threadId.set(id); localStorage.setItem('chat-thread-id', id); } }).

4. The onThreadId callback fires once when the server creates a new thread. After that, the same thread ID is reused and the full conversation history is restored from the LangGraph server.

5. To start a new conversation, call this.threadId.set(null) — this causes agent to create a fresh thread on the next submit.

No changes to the template are needed.
