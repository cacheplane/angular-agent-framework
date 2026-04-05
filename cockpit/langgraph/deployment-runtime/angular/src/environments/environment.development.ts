/**
 * Development environment configuration.
 *
 * Points to a local LangGraph server started with:
 *   cd cockpit/langgraph/deployment-runtime/python && langgraph dev
 */
export const environment = {
  production: false,
  langGraphApiUrl: 'http://localhost:4307/api',
  deploymentRuntimeAssistantId: 'deployment-runtime',
};
