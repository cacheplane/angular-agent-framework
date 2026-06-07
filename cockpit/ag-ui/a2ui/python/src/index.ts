export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'ag-ui';
    section: 'core-capabilities';
    topic: 'a2ui';
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

export const agUiA2uiPythonModule: CockpitCapabilityModule = {
  id: 'ag-ui-a2ui-python',
  manifestIdentity: {
    product: 'ag-ui',
    section: 'core-capabilities',
    topic: 'a2ui',
    page: 'overview',
    language: 'python',
  },
  title: 'AG-UI A2UI (Python)',
  docsPath: '/docs/ag-ui/core-capabilities/a2ui/overview/python',
  promptAssetPaths: ['cockpit/ag-ui/a2ui/python/prompts/a2ui.md'],
  codeAssetPaths: [
    'cockpit/ag-ui/a2ui/angular/src/app/a2ui.component.ts',
    'cockpit/ag-ui/a2ui/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/ag-ui/a2ui/python/src/graph.py',
    'cockpit/ag-ui/a2ui/python/src/server.py',
  ],
  docsAssetPaths: ['cockpit/ag-ui/a2ui/python/docs/guide.md'],
  runtimeUrl: 'ag-ui/a2ui',
  devPort: 4324,
};
