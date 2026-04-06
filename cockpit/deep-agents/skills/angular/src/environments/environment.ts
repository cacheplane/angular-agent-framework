/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * The assistantId must match the graph name in langgraph.json.
 */
export const environment = {
  production: true,
  langGraphApiUrl: 'https://skills-802ff50f64325f1ea973cff1c97a49f9.us.langgraph.app',
  streamingAssistantId: 'skills',
};
