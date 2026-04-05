export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'langgraph';
    section: 'core-capabilities';
    topic: 'streaming';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const langgraphStreamingAngularModule: CockpitCapabilityModule = {
  id: 'langgraph-streaming-angular',
  manifestIdentity: {
    product: 'langgraph',
    section: 'core-capabilities',
    topic: 'streaming',
    page: 'overview',
    language: 'angular',
  },
  title: 'LangGraph Streaming (Angular)',
  docsPath: '/docs/langgraph/core-capabilities/streaming/overview/angular',
  promptAssetPaths: [
    'cockpit/langgraph/streaming/angular/prompts/streaming.md',
  ],
  codeAssetPaths: [
    'cockpit/langgraph/streaming/angular/src/app.component.ts',
  ],
};
