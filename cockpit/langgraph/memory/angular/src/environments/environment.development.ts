/**
 * Development environment configuration.
 *
 * Points to a local LangGraph server started with:
 *   cd cockpit/langgraph/memory/python && langgraph dev
 */
export const environment = {
  production: false,
  langGraphApiUrl: '/api',
  streamingAssistantId: 'memory',
};
