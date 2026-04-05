export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'deep-agents';
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

export const deepAgentsMemoryPythonModule: CockpitCapabilityModule = {
  id: 'deep-agents-memory-python',
  manifestIdentity: {
    product: 'deep-agents',
    section: 'core-capabilities',
    topic: 'memory',
    page: 'overview',
    language: 'python',
  },
  title: 'Deep Agents Memory (Python)',
  docsPath: '/docs/deep-agents/core-capabilities/memory/overview/python',
  promptAssetPaths: ['cockpit/deep-agents/memory/python/prompts/memory.md'],
  codeAssetPaths: [
    'cockpit/deep-agents/memory/angular/src/app/memory.component.ts',
    'cockpit/deep-agents/memory/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/deep-agents/memory/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/deep-agents/memory/python/docs/guide.md'],
  runtimeUrl: 'deep-agents/memory',
  devPort: 4313,
};
