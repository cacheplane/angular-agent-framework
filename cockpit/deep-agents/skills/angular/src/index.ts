export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'deep-agents';
    section: 'core-capabilities';
    topic: 'skills';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const deepAgentsSkillsAngularModule: CockpitCapabilityModule = {
  id: 'deep-agents-skills-angular',
  manifestIdentity: {
    product: 'deep-agents',
    section: 'core-capabilities',
    topic: 'skills',
    page: 'overview',
    language: 'angular',
  },
  title: 'Deep Agents Skills (Angular)',
  docsPath: '/docs/deep-agents/core-capabilities/skills/overview/angular',
  promptAssetPaths: [
    'cockpit/deep-agents/skills/angular/prompts/skills.md',
  ],
  codeAssetPaths: [
    'cockpit/deep-agents/skills/angular/src/app.component.ts',
  ],
};
