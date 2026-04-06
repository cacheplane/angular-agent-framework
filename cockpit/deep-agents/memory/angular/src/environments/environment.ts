/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * The assistantId must match the graph name in langgraph.json.
 */
export const environment = {
  production: true,
  langGraphApiUrl: 'https://da-memory-15f767adfa6f5cd48bd45a0fa4db29b5.us.langgraph.app',
  streamingAssistantId: 'da-memory',
};
