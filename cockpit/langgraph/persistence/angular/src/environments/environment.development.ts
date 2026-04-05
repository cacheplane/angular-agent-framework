/**
 * Development environment configuration.
 *
 * Points to a local LangGraph server started with:
 *   cd cockpit/langgraph/persistence/python && langgraph dev
 */
export const environment = {
  production: false,
  langGraphApiUrl: 'http://localhost:4301/api',
  streamingAssistantId: 'persistence',
};
