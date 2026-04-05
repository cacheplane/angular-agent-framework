export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'langgraph';
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

export const langgraphInterruptsAngularModule: CockpitCapabilityModule = {
  id: 'langgraph-interrupts-angular',
  manifestIdentity: {
    product: 'langgraph',
    section: 'core-capabilities',
    topic: 'interrupts',
    page: 'overview',
    language: 'angular',
  },
  title: 'LangGraph Interrupts (Angular)',
  docsPath: '/docs/langgraph/core-capabilities/interrupts/overview/angular',
  promptAssetPaths: [
    'cockpit/langgraph/interrupts/angular/prompts/interrupts.md',
  ],
  codeAssetPaths: [
    'cockpit/langgraph/interrupts/angular/src/app.component.ts',
  ],
};
