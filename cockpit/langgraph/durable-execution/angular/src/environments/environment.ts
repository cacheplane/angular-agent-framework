/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * The assistantId must match the graph name in langgraph.json.
 */
export const environment = {
  production: true,
  langGraphApiUrl: 'https://durable-execution-123221d8b543545399d252dc6bd7de1b.us.langgraph.app',
  streamingAssistantId: 'durable-execution',
};
