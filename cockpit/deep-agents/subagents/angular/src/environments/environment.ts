/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * The assistantId must match the graph name in langgraph.json.
 */
export const environment = {
  production: true,
  langGraphApiUrl: 'https://da-subagents-31e4639441165df7848aaad426e61728.us.langgraph.app',
  streamingAssistantId: 'subagents',
};
