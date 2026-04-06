/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * The assistantId must match the graph name in langgraph.json.
 */
export const environment = {
  production: true,
  langGraphApiUrl: 'https://streaming-b01895ee8c8d5211967fba7a64c55db8.us.langgraph.app',
  streamingAssistantId: 'streaming',
};
