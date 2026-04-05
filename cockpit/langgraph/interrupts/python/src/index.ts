export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'langgraph';
    section: 'core-capabilities';
    topic: 'interrupts';
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

export const langgraphInterruptsPythonModule: CockpitCapabilityModule = {
  id: 'langgraph-interrupts-python',
  manifestIdentity: {
    product: 'langgraph',
    section: 'core-capabilities',
    topic: 'interrupts',
    page: 'overview',
    language: 'python',
  },
  title: 'LangGraph Interrupts (Python)',
  docsPath: '/docs/langgraph/core-capabilities/interrupts/overview/python',
  promptAssetPaths: ['cockpit/langgraph/interrupts/python/prompts/interrupts.md'],
  codeAssetPaths: [
    'cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts',
    'cockpit/langgraph/interrupts/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/langgraph/interrupts/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/langgraph/interrupts/python/docs/guide.md'],
  runtimeUrl: 'langgraph/interrupts',
  devPort: 4302,
};
