/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * The assistantId must match the graph name in langgraph.json.
 */
export const environment = {
  production: true,
  langGraphApiUrl: 'https://persistence-b4038c008b5e537787dda6a6774c8f91.us.langgraph.app',
  streamingAssistantId: 'persistence',
};
