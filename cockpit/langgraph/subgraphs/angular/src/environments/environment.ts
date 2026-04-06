/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * The assistantId must match the graph name in langgraph.json.
 */
export const environment = {
  production: true,
  langGraphApiUrl: 'https://subgraphs-c923bcb068c458b09d789f147875f426.us.langgraph.app',
  streamingAssistantId: 'subgraphs',
};
