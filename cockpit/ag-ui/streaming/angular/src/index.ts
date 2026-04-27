export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'ag-ui';
    section: 'core-capabilities';
    topic: 'streaming';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const agUiStreamingAngularModule: CockpitCapabilityModule = {
  id: 'ag-ui-streaming-angular',
  manifestIdentity: {
    product: 'ag-ui',
    section: 'core-capabilities',
    topic: 'streaming',
    page: 'overview',
    language: 'angular',
  },
  title: 'AG-UI Streaming (Angular)',
  docsPath: '/docs/ag-ui/core-capabilities/streaming/overview/angular',
  promptAssetPaths: [
    'cockpit/ag-ui/streaming/angular/prompts/streaming.md',
  ],
  codeAssetPaths: [
    'cockpit/ag-ui/streaming/angular/src/app/streaming.component.ts',
  ],
};
