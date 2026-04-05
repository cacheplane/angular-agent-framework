/**
 * Development environment configuration.
 *
 * Points to a local LangGraph server started with:
 *   cd cockpit/deep-agents/subagents/python && langgraph dev
 */
export const environment = {
  production: false,
  langGraphApiUrl: 'http://localhost:4312/api',
  streamingAssistantId: 'subagents',
};
