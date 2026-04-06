/**
 * Development environment configuration.
 *
 * Points to a local LangGraph server started with:
 *   cd cockpit/langgraph/deployment-runtime/python && langgraph dev
 */
export const environment = {
  production: false,
  langGraphApiUrl: '/api',
  deploymentRuntimeAssistantId: 'deployment-runtime',
};
