export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'chat';
    section: 'core-capabilities';
    topic: 'generative-ui';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const chatGenerativeUiAngularModule: CockpitCapabilityModule = {
  id: 'chat-generative-ui-angular',
  manifestIdentity: {
    product: 'chat',
    section: 'core-capabilities',
    topic: 'generative-ui',
    page: 'overview',
    language: 'angular',
  },
  title: 'Chat Generative UI (Angular)',
  docsPath: '/docs/chat/core-capabilities/generative-ui/overview/angular',
  promptAssetPaths: ['cockpit/chat/generative-ui/python/prompts/generative-ui.md'],
  codeAssetPaths: ['cockpit/chat/generative-ui/angular/src/app/generative-ui.component.ts'],
};
