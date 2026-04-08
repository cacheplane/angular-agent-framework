export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'render';
    section: 'core-capabilities';
    topic: 'computed-functions';
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

export const renderComputedFunctionsPythonModule: CockpitCapabilityModule = {
  id: 'render-computed-functions-python',
  manifestIdentity: {
    product: 'render',
    section: 'core-capabilities',
    topic: 'computed-functions',
    page: 'overview',
    language: 'python',
  },
  title: 'Render Computed Functions (Python)',
  docsPath: '/docs/render/core-capabilities/computed-functions/overview/python',
  promptAssetPaths: ['cockpit/render/computed-functions/python/prompts/computed-functions.md'],
  codeAssetPaths: [
    'cockpit/render/computed-functions/angular/src/app/computed-functions.component.ts',
    'cockpit/render/computed-functions/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/render/computed-functions/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/render/computed-functions/python/docs/guide.md'],
  runtimeUrl: 'render/computed-functions',
  devPort: 4406,
};
