export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'chat';
    section: 'core-capabilities';
    topic: 'tool-calls';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const chatToolCallsAngularModule: CockpitCapabilityModule = {
  id: 'chat-tool-calls-angular',
  manifestIdentity: {
    product: 'chat',
    section: 'core-capabilities',
    topic: 'tool-calls',
    page: 'overview',
    language: 'angular',
  },
  title: 'Chat Tool Calls (Angular)',
  docsPath: '/docs/chat/core-capabilities/tool-calls/overview/angular',
  promptAssetPaths: ['cockpit/chat/tool-calls/python/prompts/tool-calls.md'],
  codeAssetPaths: ['cockpit/chat/tool-calls/angular/src/app/tool-calls.component.ts'],
};
