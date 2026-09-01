export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'deep-agents';
    section: 'core-capabilities';
    topic: 'planning';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const deepAgentsPlanningAngularModule: CockpitCapabilityModule = {
  id: 'deep-agents-planning-angular',
  manifestIdentity: {
    product: 'deep-agents',
    section: 'core-capabilities',
    topic: 'planning',
    page: 'overview',
    language: 'angular',
  },
  title: 'Deep Agents Planning (Angular)',
  // No `deep-agents` library exists on the website yet; the empty string is
  // the "no published docs page" sentinel and renders no Docs link.
  docsPath: '',
  promptAssetPaths: [
    'cockpit/deep-agents/planning/angular/prompts/planning.md',
  ],
  codeAssetPaths: [
    'cockpit/deep-agents/planning/angular/src/app/planning.component.ts',
    'cockpit/deep-agents/planning/angular/src/app/app.config.ts',
  ],
};
