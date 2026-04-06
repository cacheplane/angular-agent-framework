/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * The assistantId must match the graph name in langgraph.json.
 */
export const environment = {
  production: true,
  langGraphApiUrl: 'https://deployment-runtime-ce6aad33cc10505faca2b6137e76ba35.us.langgraph.app',
  deploymentRuntimeAssistantId: 'deployment-runtime',
};
