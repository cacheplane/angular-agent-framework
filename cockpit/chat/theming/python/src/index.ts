export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'chat';
    section: 'core-capabilities';
    topic: 'theming';
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

export const chatThemingPythonModule: CockpitCapabilityModule = {
  id: 'chat-theming-python',
  manifestIdentity: {
    product: 'chat',
    section: 'core-capabilities',
    topic: 'theming',
    page: 'overview',
    language: 'python',
  },
  title: 'Chat Theming (Python)',
  docsPath: '/docs/chat/core-capabilities/theming/overview/python',
  promptAssetPaths: ['cockpit/chat/theming/python/prompts/theming.md'],
  codeAssetPaths: [
    'cockpit/chat/theming/angular/src/app/theming.component.ts',
    'cockpit/chat/theming/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/chat/theming/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/chat/theming/python/docs/guide.md'],
  runtimeUrl: 'chat/theming',
  devPort: 4510,
};
