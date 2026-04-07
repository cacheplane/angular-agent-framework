/**
 * Development environment configuration.
 *
 * Points to a local LangGraph server started with:
 *   cd cockpit/deep-agents/planning/python && langgraph dev
 */
export const environment = {
  production: false,
  langGraphApiUrl: 'http://localhost:4310/api',
  streamingAssistantId: 'planning',
  planningAssistantId: 'planning',
};
