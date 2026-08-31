export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'runtimes';
    section: 'core-capabilities';
    topic: 'mastra';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const runtimesMastraAngularModule: CockpitCapabilityModule = {
  id: 'runtimes-mastra-angular',
  manifestIdentity: {
    product: 'runtimes',
    section: 'core-capabilities',
    topic: 'mastra',
    page: 'overview',
    language: 'angular',
  },
  title: 'Runtimes — Mastra (Angular)',
  docsPath: '/docs/runtimes/core-capabilities/mastra/overview/angular',
  promptAssetPaths: [
    'cockpit/runtimes/mastra/angular/prompts/mastra.md',
  ],
  codeAssetPaths: [
    'cockpit/runtimes/mastra/angular/src/app/mastra.component.ts',
    'cockpit/runtimes/mastra/angular/src/app/app.config.ts',
  ],
};
