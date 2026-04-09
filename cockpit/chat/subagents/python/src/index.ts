export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'chat';
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

export const chatSubagentsPythonModule: CockpitCapabilityModule = {
  id: 'chat-subagents-python',
  manifestIdentity: {
    product: 'chat',
    section: 'core-capabilities',
    topic: 'subagents',
    page: 'overview',
    language: 'python',
  },
  title: 'Chat Subagents (Python)',
  docsPath: '/docs/chat/core-capabilities/subagents/overview/python',
  promptAssetPaths: ['cockpit/chat/subagents/python/prompts/subagents.md'],
  codeAssetPaths: [
    'cockpit/chat/subagents/angular/src/app/subagents.component.ts',
    'cockpit/chat/subagents/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/chat/subagents/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/chat/subagents/python/docs/guide.md'],
  runtimeUrl: 'chat/subagents',
  devPort: 4505,
};
