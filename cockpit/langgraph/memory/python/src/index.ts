export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'langgraph';
    section: 'core-capabilities';
    topic: 'memory';
    page: 'overview';
    language: 'python';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
  backendAssetPaths: string[];
  docsAssetPaths: string[];
  runtimeUrl?: string;
  devPort?: number;
}

export const langgraphMemoryPythonModule: CockpitCapabilityModule = {
  id: 'langgraph-memory-python',
  manifestIdentity: {
    product: 'langgraph',
    section: 'core-capabilities',
    topic: 'memory',
    page: 'overview',
    language: 'python',
  },
  title: 'LangGraph Memory (Python)',
  docsPath: '/docs/langgraph/core-capabilities/memory/overview/python',
  promptAssetPaths: ['cockpit/langgraph/memory/python/prompts/memory.md'],
  codeAssetPaths: [
    'cockpit/langgraph/memory/angular/src/app/memory.component.ts',
    'cockpit/langgraph/memory/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/langgraph/memory/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/langgraph/memory/python/docs/guide.md'],
  runtimeUrl: 'langgraph/memory',
  devPort: 4303,
};
