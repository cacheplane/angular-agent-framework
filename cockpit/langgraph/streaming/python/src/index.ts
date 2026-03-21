export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'langgraph';
    section: 'core-capabilities';
    topic: 'streaming';
    page: 'overview';
    language: 'python';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const langgraphStreamingPythonModule: CockpitCapabilityModule = {
  id: 'langgraph-streaming-python',
  manifestIdentity: {
    product: 'langgraph',
    section: 'core-capabilities',
    topic: 'streaming',
    page: 'overview',
    language: 'python',
  },
  title: 'LangGraph Streaming (Python)',
  docsPath: '/docs/langgraph/streaming',
  promptAssetPaths: ['cockpit/langgraph/streaming/python/prompts/streaming.md'],
  codeAssetPaths: ['cockpit/langgraph/streaming/python/src/index.ts'],
};
