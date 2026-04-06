/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * The assistantId must match the graph name in langgraph.json.
 */
export const environment = {
  production: true,
  langGraphApiUrl: 'https://planning-7ca04c65ce7650048ec0d16fb96a7638.us.langgraph.app',
  streamingAssistantId: 'planning',
};
