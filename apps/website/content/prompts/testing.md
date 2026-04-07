Write unit tests for my Angular component that uses angular, without hitting a real LangGraph server.

Use MockAgentTransport from '@cacheplane/angular'. It implements AgentTransport and lets you script exactly what events the stream emits.

Test setup:
const transport = new MockAgentTransport();
const chat = agent({ transport, assistantId: 'test', apiUrl: '' });

To emit a streaming response:
transport.emit([
  { type: 'values', values: { messages: [] } },
  { type: 'messages', messages: [[{ type: 'ai', content: 'Hello' }, { id: '1' }]] },
]);

Assertions after emit:
expect(chat.messages()).toHaveLength(1);
expect(chat.messages()[0].content).toBe('Hello');

To test error state:
transport.emitError(new Error('Network failure'));
expect(chat.status()).toBe('error');
expect(chat.error()).toBeInstanceOf(Error);

Never mock agent() itself — always use MockAgentTransport and test through the real function.
