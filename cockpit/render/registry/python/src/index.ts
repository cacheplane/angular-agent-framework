export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'render';
    section: 'core-capabilities';
    topic: 'registry';
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

export const renderRegistryPythonModule: CockpitCapabilityModule = {
  id: 'render-registry-python',
  manifestIdentity: {
    product: 'render',
    section: 'core-capabilities',
    topic: 'registry',
    page: 'overview',
    language: 'python',
  },
  title: 'Render Registry (Python)',
  docsPath: '/docs/render/core-capabilities/registry/overview/python',
  promptAssetPaths: ['cockpit/render/registry/python/prompts/registry.md'],
  codeAssetPaths: [
    'cockpit/render/registry/angular/src/app/registry.component.ts',
    'cockpit/render/registry/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/render/registry/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/render/registry/python/docs/guide.md'],
  runtimeUrl: 'render/registry',
  devPort: 4404,
};
