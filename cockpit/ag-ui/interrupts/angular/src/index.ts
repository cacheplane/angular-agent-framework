export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'ag-ui';
    section: 'core-capabilities';
    topic: 'interrupts';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const agUiInterruptsAngularModule: CockpitCapabilityModule = {
  id: 'ag-ui-interrupts-angular',
  manifestIdentity: {
    product: 'ag-ui',
    section: 'core-capabilities',
    topic: 'interrupts',
    page: 'overview',
    language: 'angular',
  },
  title: 'AG-UI Interrupts (Angular)',
  docsPath: '/docs/ag-ui/core-capabilities/interrupts/overview/angular',
  promptAssetPaths: [
    'cockpit/ag-ui/interrupts/angular/prompts/interrupts.md',
  ],
  codeAssetPaths: [
    'cockpit/ag-ui/interrupts/angular/src/app.component.ts',
  ],
};
