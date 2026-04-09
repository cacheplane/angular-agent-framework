export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'chat';
    section: 'core-capabilities';
    topic: 'debug';
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

export const chatDebugPythonModule: CockpitCapabilityModule = {
  id: 'chat-debug-python',
  manifestIdentity: {
    product: 'chat',
    section: 'core-capabilities',
    topic: 'debug',
    page: 'overview',
    language: 'python',
  },
  title: 'Chat Debug (Python)',
  docsPath: '/docs/chat/core-capabilities/debug/overview/python',
  promptAssetPaths: ['cockpit/chat/debug/python/prompts/debug.md'],
  codeAssetPaths: [
    'cockpit/chat/debug/angular/src/app/debug.component.ts',
    'cockpit/chat/debug/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/chat/debug/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/chat/debug/python/docs/guide.md'],
  runtimeUrl: 'chat/debug',
  devPort: 4509,
};
