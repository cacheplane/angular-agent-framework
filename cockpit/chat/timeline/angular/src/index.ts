export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'chat';
    section: 'core-capabilities';
    topic: 'timeline';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const chatTimelineAngularModule: CockpitCapabilityModule = {
  id: 'chat-timeline-angular',
  manifestIdentity: {
    product: 'chat',
    section: 'core-capabilities',
    topic: 'timeline',
    page: 'overview',
    language: 'angular',
  },
  title: 'Chat Timeline (Angular)',
  docsPath: '/docs/chat/core-capabilities/timeline/overview/angular',
  promptAssetPaths: ['cockpit/chat/timeline/python/prompts/timeline.md'],
  codeAssetPaths: ['cockpit/chat/timeline/angular/src/app/timeline.component.ts'],
};
