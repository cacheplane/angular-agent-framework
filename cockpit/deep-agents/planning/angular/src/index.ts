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
  docsPath: '/docs/deep-agents/core-capabilities/planning/overview/angular',
  promptAssetPaths: [
    'cockpit/deep-agents/planning/angular/prompts/planning.md',
  ],
  codeAssetPaths: [
    'cockpit/deep-agents/planning/angular/src/app.component.ts',
  ],
};
