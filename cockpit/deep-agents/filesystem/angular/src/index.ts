export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'deep-agents';
    section: 'core-capabilities';
    topic: 'filesystem';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const deepAgentsFilesystemAngularModule: CockpitCapabilityModule = {
  id: 'deep-agents-filesystem-angular',
  manifestIdentity: {
    product: 'deep-agents',
    section: 'core-capabilities',
    topic: 'filesystem',
    page: 'overview',
    language: 'angular',
  },
  title: 'Deep Agents Filesystem (Angular)',
  docsPath: '/docs/deep-agents/core-capabilities/filesystem/overview/angular',
  promptAssetPaths: [
    'cockpit/deep-agents/filesystem/angular/prompts/filesystem.md',
  ],
  codeAssetPaths: [
    'cockpit/deep-agents/filesystem/angular/src/app.component.ts',
  ],
};
