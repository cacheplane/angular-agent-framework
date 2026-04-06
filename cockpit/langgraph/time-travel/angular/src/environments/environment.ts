/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * The assistantId must match the graph name in langgraph.json.
 */
export const environment = {
  production: true,
  langGraphApiUrl: 'https://time-travel-f206148d75f45e75bf30002e68e1b14d.us.langgraph.app',
  streamingAssistantId: 'time-travel',
};
