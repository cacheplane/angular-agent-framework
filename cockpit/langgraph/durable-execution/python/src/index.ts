export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'langgraph';
    section: 'fault-tolerance';
    topic: 'durable-execution';
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

export const langgraphDurableExecutionPythonModule: CockpitCapabilityModule = {
  id: 'langgraph-durable-execution-python',
  manifestIdentity: {
    product: 'langgraph',
    section: 'fault-tolerance',
    topic: 'durable-execution',
    page: 'overview',
    language: 'python',
  },
  title: 'LangGraph Durable Execution (Python)',
  docsPath: '/docs/langgraph/fault-tolerance/durable-execution/overview/python',
  promptAssetPaths: ['cockpit/langgraph/durable-execution/python/prompts/durable-execution.md'],
  codeAssetPaths: [
    'cockpit/langgraph/durable-execution/angular/src/app/durable-execution.component.ts',
    'cockpit/langgraph/durable-execution/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/langgraph/durable-execution/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/langgraph/durable-execution/python/docs/guide.md'],
  runtimeUrl: 'langgraph/durable-execution',
  devPort: 4304,
};
