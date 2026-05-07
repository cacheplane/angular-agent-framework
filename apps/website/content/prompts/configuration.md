Configure angular globally and per-component in my Angular application.

Global config (applies to all agent() calls in the app):
In app.config.ts, provideAgent({ apiUrl: 'https://my-langgraph-server.com', }) — import provideAgent from '@ngaf/langgraph'.

Per-call override (overrides global config for one component):
Pass apiUrl directly to agent({ apiUrl: 'https://other-server.com', assistantId: 'my-agent' }) — per-call options take precedence over global config.

Custom transport (for auth headers, logging, or testing):
Implement the AgentTransport interface from @ngaf/langgraph. Its required method is stream(assistantId, threadId, payload, signal, options), and optional methods cover queued runs, cancellation, history, and updateState. Pass an AgentTransport instance as transport: myTransport to either provideAgent() or agent(). FetchStreamTransport is the default.

To pass a system prompt to the LangGraph agent per-thread, use the config option:
agent({ config: { configurable: { system_prompt: 'You are a helpful assistant.' } } })
