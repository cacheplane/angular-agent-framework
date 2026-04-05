export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'deep-agents';
    section: 'core-capabilities';
    topic: 'memory';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const deepAgentsMemoryAngularModule: CockpitCapabilityModule = {
  id: 'deep-agents-memory-angular',
  manifestIdentity: {
    product: 'deep-agents',
    section: 'core-capabilities',
    topic: 'memory',
    page: 'overview',
    language: 'angular',
  },
  title: 'Deep Agents Memory (Angular)',
  docsPath: '/docs/deep-agents/core-capabilities/memory/overview/angular',
  promptAssetPaths: [
    'cockpit/deep-agents/memory/angular/prompts/memory.md',
  ],
  codeAssetPaths: [
    'cockpit/deep-agents/memory/angular/src/app.component.ts',
  ],
};
