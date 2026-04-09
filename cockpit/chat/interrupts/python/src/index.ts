export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'chat';
    section: 'core-capabilities';
    topic: 'interrupts';
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

export const chatInterruptsPythonModule: CockpitCapabilityModule = {
  id: 'chat-interrupts-python',
  manifestIdentity: {
    product: 'chat',
    section: 'core-capabilities',
    topic: 'interrupts',
    page: 'overview',
    language: 'python',
  },
  title: 'Chat Interrupts (Python)',
  docsPath: '/docs/chat/core-capabilities/interrupts/overview/python',
  promptAssetPaths: ['cockpit/chat/interrupts/python/prompts/interrupts.md'],
  codeAssetPaths: [
    'cockpit/chat/interrupts/angular/src/app/interrupts.component.ts',
    'cockpit/chat/interrupts/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/chat/interrupts/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/chat/interrupts/python/docs/guide.md'],
  runtimeUrl: 'chat/interrupts',
  devPort: 4503,
};
