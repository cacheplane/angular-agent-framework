/**
 * Development environment configuration.
 *
 * Points to a local LangGraph server started with:
 *   cd cockpit/deep-agents/filesystem/python && langgraph dev
 */
export const environment = {
  production: false,
  langGraphApiUrl: '/api',
  streamingAssistantId: 'filesystem',
};
