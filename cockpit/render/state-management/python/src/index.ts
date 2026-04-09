export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'render';
    section: 'core-capabilities';
    topic: 'state-management';
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

export const renderStateManagementPythonModule: CockpitCapabilityModule = {
  id: 'render-state-management-python',
  manifestIdentity: {
    product: 'render',
    section: 'core-capabilities',
    topic: 'state-management',
    page: 'overview',
    language: 'python',
  },
  title: 'Render State Management (Python)',
  docsPath: '/docs/render/core-capabilities/state-management/overview/python',
  promptAssetPaths: ['cockpit/render/state-management/python/prompts/state-management.md'],
  codeAssetPaths: [
    'cockpit/render/state-management/angular/src/app/state-management.component.ts',
    'cockpit/render/state-management/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/render/state-management/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/render/state-management/python/docs/guide.md'],
  runtimeUrl: 'render/state-management',
  devPort: 4403,
};
