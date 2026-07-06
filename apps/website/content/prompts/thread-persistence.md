Add thread persistence to my Angular component that uses angular, so conversations survive page refresh.

1. Put thread persistence in an injectable service so provider config can read it from Angular DI.

2. In that service, create a signal from storage: threadId = signal<string | null>(localStorage.getItem('chat-thread-id')).

3. Configure the agent with a provider factory: provideAgent(() => { const memory = inject(ThreadMemory); return { assistantId: 'chat', threadId: memory.threadId, onThreadId: (id) => memory.remember(id) }; }).

4. The onThreadId callback fires once when the server creates a new thread. After that, the same thread ID is reused and the full conversation history is restored from the LangGraph server.

5. To start a new conversation, call memory.threadId.set(null) and clear storage — this causes the injected agent to create a fresh thread on the next submit.

No changes to the template are needed.
