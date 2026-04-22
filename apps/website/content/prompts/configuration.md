Configure angular globally and per-component in my Angular application.

Global config (applies to all agent() calls in the app):
In app.config.ts, provideAgent({ apiUrl: 'https://my-langgraph-server.com', }) — import provideAgent from '@cacheplane/langgraph'.

Per-call override (overrides global config for one component):
Pass apiUrl directly to agent({ apiUrl: 'https://other-server.com', assistantId: 'my-agent' }) — per-call options take precedence over global config.

Custom transport (for auth headers, logging, or testing):
Implement AgentTransport interface — it has one method: stream(input, options). Pass it as transport: myTransport to either provideAgent or agent(). FetchStreamTransport is the default.

To pass a system prompt to the LangGraph agent per-thread, use the config option:
agent({ config: { configurable: { system_prompt: 'You are a helpful assistant.' } } })
