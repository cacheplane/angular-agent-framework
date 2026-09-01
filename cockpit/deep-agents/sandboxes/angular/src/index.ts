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
  // No `deep-agents` library exists on the website yet; the empty string is
  // the "no published docs page" sentinel and renders no Docs link.
  docsPath: '',
  promptAssetPaths: [
    'cockpit/deep-agents/sandboxes/angular/prompts/sandboxes.md',
  ],
  codeAssetPaths: [
    'cockpit/deep-agents/sandboxes/angular/src/app.component.ts',
  ],
};
