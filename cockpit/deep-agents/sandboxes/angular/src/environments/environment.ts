/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * The assistantId must match the graph name in langgraph.json.
 */
export const environment = {
  production: true,
  langGraphApiUrl: 'https://sandboxes-8c70b6ac20265827aa92397299fcb9f7.us.langgraph.app',
  streamingAssistantId: 'sandboxes',
};
