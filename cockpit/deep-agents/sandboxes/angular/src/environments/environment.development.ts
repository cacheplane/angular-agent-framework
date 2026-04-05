/**
 * Development environment configuration.
 *
 * Points to a local LangGraph server started with:
 *   cd cockpit/deep-agents/sandboxes/python && langgraph dev
 */
export const environment = {
  production: false,
  langGraphApiUrl: 'http://localhost:4315/api',
  streamingAssistantId: 'sandboxes',
};
