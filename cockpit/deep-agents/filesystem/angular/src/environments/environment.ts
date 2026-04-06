/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * The assistantId must match the graph name in langgraph.json.
 */
export const environment = {
  production: true,
  langGraphApiUrl: 'https://filesystem-2330285f57625bff8654bc026f70a6ae.us.langgraph.app',
  streamingAssistantId: 'filesystem',
};
