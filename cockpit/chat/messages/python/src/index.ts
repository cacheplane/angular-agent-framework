export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'chat';
    section: 'core-capabilities';
    topic: 'messages';
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

export const chatMessagesPythonModule: CockpitCapabilityModule = {
  id: 'chat-messages-python',
  manifestIdentity: {
    product: 'chat',
    section: 'core-capabilities',
    topic: 'messages',
    page: 'overview',
    language: 'python',
  },
  title: 'Chat Messages (Python)',
  docsPath: '/docs/chat/core-capabilities/messages/overview/python',
  promptAssetPaths: ['cockpit/chat/messages/python/prompts/messages.md'],
  codeAssetPaths: [
    'cockpit/chat/messages/angular/src/app/messages.component.ts',
    'cockpit/chat/messages/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/chat/messages/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/chat/messages/python/docs/guide.md'],
  runtimeUrl: 'chat/messages',
  devPort: 4501,
};
