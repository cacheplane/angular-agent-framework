export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'chat';
    section: 'core-capabilities';
    topic: 'interrupts';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const chatInterruptsAngularModule: CockpitCapabilityModule = {
  id: 'chat-interrupts-angular',
  manifestIdentity: {
    product: 'chat',
    section: 'core-capabilities',
    topic: 'interrupts',
    page: 'overview',
    language: 'angular',
  },
  title: 'Chat Interrupts (Angular)',
  docsPath: '/docs/chat/core-capabilities/interrupts/overview/angular',
  promptAssetPaths: ['cockpit/chat/interrupts/python/prompts/interrupts.md'],
  codeAssetPaths: ['cockpit/chat/interrupts/angular/src/app/interrupts.component.ts'],
};
