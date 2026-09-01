export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'deep-agents';
    section: 'core-capabilities';
    topic: 'subagents';
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

export const deepAgentsSubagentsPythonModule: CockpitCapabilityModule = {
  id: 'deep-agents-subagents-python',
  manifestIdentity: {
    product: 'deep-agents',
    section: 'core-capabilities',
    topic: 'subagents',
    page: 'overview',
    language: 'python',
  },
  title: 'Deep Agents Subagents (Python)',
  // No `deep-agents` library exists on the website yet; the empty string is
  // the "no published docs page" sentinel and renders no Docs link.
  docsPath: '',
  promptAssetPaths: ['cockpit/deep-agents/subagents/python/prompts/subagents.md'],
  codeAssetPaths: [
    'cockpit/deep-agents/subagents/angular/src/app/subagents.component.ts',
    'cockpit/deep-agents/subagents/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/deep-agents/subagents/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/deep-agents/subagents/python/docs/guide.md'],
  runtimeUrl: 'deep-agents/subagents',
  devPort: 4312,
};
