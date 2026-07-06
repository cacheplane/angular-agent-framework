Configure angular globally and per-component in my Angular application.

Global config:
In app.config.ts, call provideAgent({ apiUrl: 'https://my-langgraph-server.com', assistantId: 'my-agent' }) in the providers array. Import provideAgent from '@threadplane/langgraph'.

Scoped override for one component subtree:
Add providers: [provideAgent({ apiUrl: 'https://other-server.com', assistantId: 'other-agent' })] on that component. Components under that subtree call injectAgent() and receive the scoped singleton.

Custom transport (for auth headers, logging, or testing):
Implement the AgentTransport interface from @threadplane/langgraph. Its required method is stream(assistantId, threadId, payload, signal, options), and optional methods cover queued runs, cancellation, history, and updateState. Pass an AgentTransport instance as transport: myTransport to provideAgent(). FetchStreamTransport is the default.

To pass per-run LangGraph config, pass it when submitting:
chat.submit({ message }, { config: { configurable: { system_prompt: 'You are a helpful assistant.' } } })
