export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'deep-agents';
    section: 'core-capabilities';
    topic: 'sandboxes';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const deepAgentsSandboxesAngularModule: CockpitCapabilityModule = {
  id: 'deep-agents-sandboxes-angular',
  manifestIdentity: {
    product: 'deep-agents',
    section: 'core-capabilities',
    topic: 'sandboxes',
    page: 'overview',
    language: 'angular',
  },
  title: 'Deep Agents Sandboxes (Angular)',
  docsPath: '/docs/deep-agents/core-capabilities/sandboxes/overview/angular',
  promptAssetPaths: [
    'cockpit/deep-agents/sandboxes/angular/prompts/sandboxes.md',
  ],
  codeAssetPaths: [
    'cockpit/deep-agents/sandboxes/angular/src/app.component.ts',
  ],
};
