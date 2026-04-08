export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'langgraph';
    section: 'core-capabilities';
    topic: 'generative-ui';
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

export const langgraphGenerativeUiPythonModule: CockpitCapabilityModule = {
  id: 'langgraph-generative-ui-python',
  manifestIdentity: {
    product: 'langgraph',
    section: 'core-capabilities',
    topic: 'generative-ui',
    page: 'overview',
    language: 'python',
  },
  title: 'LangGraph Generative UI (Python)',
  docsPath: '/docs/langgraph/core-capabilities/generative-ui/overview/python',
  promptAssetPaths: ['cockpit/langgraph/generative-ui/python/prompts/generative-ui.md'],
  codeAssetPaths: [
    'cockpit/langgraph/generative-ui/angular/src/app/generative-ui.component.ts',
    'cockpit/langgraph/generative-ui/angular/src/app/app.config.ts',
    'cockpit/langgraph/generative-ui/angular/src/app/views/weather-card.component.ts',
    'cockpit/langgraph/generative-ui/angular/src/app/views/stat-card.component.ts',
  ],
  backendAssetPaths: [
    'cockpit/langgraph/generative-ui/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/langgraph/generative-ui/python/docs/guide.md'],
  runtimeUrl: 'langgraph/generative-ui',
  devPort: 4310,
};
