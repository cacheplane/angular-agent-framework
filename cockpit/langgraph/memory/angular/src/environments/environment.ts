/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * The assistantId must match the graph name in langgraph.json.
 */
export const environment = {
  production: true,
  langGraphApiUrl: 'https://memory-1b3234dbe2e55ba59010b3469be45a0a.us.langgraph.app',
  streamingAssistantId: 'memory',
};
