export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'chat';
    section: 'core-capabilities';
    topic: 'tool-calls';
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

export const chatToolCallsPythonModule: CockpitCapabilityModule = {
  id: 'chat-tool-calls-python',
  manifestIdentity: {
    product: 'chat',
    section: 'core-capabilities',
    topic: 'tool-calls',
    page: 'overview',
    language: 'python',
  },
  title: 'Chat Tool Calls (Python)',
  docsPath: '/docs/chat/core-capabilities/tool-calls/overview/python',
  promptAssetPaths: ['cockpit/chat/tool-calls/python/prompts/tool-calls.md'],
  codeAssetPaths: [
    'cockpit/chat/tool-calls/angular/src/app/tool-calls.component.ts',
    'cockpit/chat/tool-calls/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/chat/tool-calls/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/chat/tool-calls/python/docs/guide.md'],
  runtimeUrl: 'chat/tool-calls',
  devPort: 4504,
};
