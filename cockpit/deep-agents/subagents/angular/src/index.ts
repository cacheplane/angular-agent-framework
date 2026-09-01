export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'deep-agents';
    section: 'core-capabilities';
    topic: 'subagents';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const deepAgentsSubagentsAngularModule: CockpitCapabilityModule = {
  id: 'deep-agents-subagents-angular',
  manifestIdentity: {
    product: 'deep-agents',
    section: 'core-capabilities',
    topic: 'subagents',
    page: 'overview',
    language: 'angular',
  },
  title: 'Deep Agents Subagents (Angular)',
  // No `deep-agents` library exists on the website yet; the empty string is
  // the "no published docs page" sentinel and renders no Docs link.
  docsPath: '',
  promptAssetPaths: [
    'cockpit/deep-agents/subagents/angular/prompts/subagents.md',
  ],
  codeAssetPaths: [
    'cockpit/deep-agents/subagents/angular/src/app.component.ts',
  ],
};
