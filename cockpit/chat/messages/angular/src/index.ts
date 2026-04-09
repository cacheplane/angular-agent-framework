export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'chat';
    section: 'core-capabilities';
    topic: 'messages';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const chatMessagesAngularModule: CockpitCapabilityModule = {
  id: 'chat-messages-angular',
  manifestIdentity: {
    product: 'chat',
    section: 'core-capabilities',
    topic: 'messages',
    page: 'overview',
    language: 'angular',
  },
  title: 'Chat Messages (Angular)',
  docsPath: '/docs/chat/core-capabilities/messages/overview/angular',
  promptAssetPaths: ['cockpit/chat/messages/python/prompts/messages.md'],
  codeAssetPaths: ['cockpit/chat/messages/angular/src/app/messages.component.ts'],
};
