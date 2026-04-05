export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'deep-agents';
    section: 'core-capabilities';
    topic: 'skills';
    page: 'overview';
    language: 'python';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
  backendAssetPaths: string[];
  docsAssetPaths: string[];
  runtimeUrl?: string;
  devPort?: number;
}

export const deepAgentsSkillsPythonModule: CockpitCapabilityModule = {
  id: 'deep-agents-skills-python',
  manifestIdentity: {
    product: 'deep-agents',
    section: 'core-capabilities',
    topic: 'skills',
    page: 'overview',
    language: 'python',
  },
  title: 'Deep Agents Skills (Python)',
  docsPath: '/docs/deep-agents/core-capabilities/skills/overview/python',
  promptAssetPaths: ['cockpit/deep-agents/skills/python/prompts/skills.md'],
  codeAssetPaths: [
    'cockpit/deep-agents/skills/angular/src/app/skills.component.ts',
    'cockpit/deep-agents/skills/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/deep-agents/skills/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/deep-agents/skills/python/docs/guide.md'],
  runtimeUrl: 'deep-agents/skills',
  devPort: 4314,
};
