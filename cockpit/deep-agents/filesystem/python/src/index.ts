export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'deep-agents';
    section: 'core-capabilities';
    topic: 'filesystem';
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

export const deepAgentsFilesystemPythonModule: CockpitCapabilityModule = {
  id: 'deep-agents-filesystem-python',
  manifestIdentity: {
    product: 'deep-agents',
    section: 'core-capabilities',
    topic: 'filesystem',
    page: 'overview',
    language: 'python',
  },
  title: 'Deep Agents Filesystem (Python)',
  docsPath: '/docs/deep-agents/core-capabilities/filesystem/overview/python',
  promptAssetPaths: ['cockpit/deep-agents/filesystem/python/prompts/filesystem.md'],
  codeAssetPaths: [
    'cockpit/deep-agents/filesystem/angular/src/app/filesystem.component.ts',
    'cockpit/deep-agents/filesystem/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/deep-agents/filesystem/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/deep-agents/filesystem/python/docs/guide.md'],
  runtimeUrl: 'deep-agents/filesystem',
  devPort: 4311,
};
