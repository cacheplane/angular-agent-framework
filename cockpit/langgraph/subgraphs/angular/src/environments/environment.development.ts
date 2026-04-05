/**
 * Development environment configuration.
 *
 * Points to a local LangGraph server started with:
 *   cd cockpit/langgraph/subgraphs/python && langgraph dev
 */
export const environment = {
  production: false,
  langGraphApiUrl: 'http://localhost:4305/api',
  streamingAssistantId: 'subgraphs',
};
