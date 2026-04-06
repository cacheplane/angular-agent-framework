/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * The assistantId must match the graph name in langgraph.json.
 */
export const environment = {
  production: true,
  langGraphApiUrl: 'https://interrupts-8e1524d6d8fb558381eed4618129bc50.us.langgraph.app',
  streamingAssistantId: 'interrupts',
};
