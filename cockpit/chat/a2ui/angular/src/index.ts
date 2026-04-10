export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'chat';
    section: 'core-capabilities';
    topic: 'a2ui';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const chatA2uiAngularModule: CockpitCapabilityModule = {
  id: 'chat-a2ui-angular',
  manifestIdentity: {
    product: 'chat',
    section: 'core-capabilities',
    topic: 'a2ui',
    page: 'overview',
    language: 'angular',
  },
  title: 'Chat A2UI (Angular)',
  docsPath: '/docs/chat/core-capabilities/a2ui/overview/angular',
  promptAssetPaths: ['cockpit/chat/a2ui/python/prompts/a2ui.md'],
  codeAssetPaths: ['cockpit/chat/a2ui/angular/src/app/a2ui.component.ts'],
};
