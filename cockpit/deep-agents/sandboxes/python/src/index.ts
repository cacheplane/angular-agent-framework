export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'deep-agents';
    section: 'core-capabilities';
    topic: 'sandboxes';
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

export const deepAgentsSandboxesPythonModule: CockpitCapabilityModule = {
  id: 'deep-agents-sandboxes-python',
  manifestIdentity: {
    product: 'deep-agents',
    section: 'core-capabilities',
    topic: 'sandboxes',
    page: 'overview',
    language: 'python',
  },
  title: 'Deep Agents Sandboxes (Python)',
  docsPath: '/docs/deep-agents/core-capabilities/sandboxes/overview/python',
  promptAssetPaths: ['cockpit/deep-agents/sandboxes/python/prompts/sandboxes.md'],
  codeAssetPaths: [
    'cockpit/deep-agents/sandboxes/angular/src/app/sandboxes.component.ts',
    'cockpit/deep-agents/sandboxes/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/deep-agents/sandboxes/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/deep-agents/sandboxes/python/docs/guide.md'],
  runtimeUrl: 'deep-agents/sandboxes',
  devPort: 4315,
};
