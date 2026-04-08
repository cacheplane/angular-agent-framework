export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'render';
    section: 'core-capabilities';
    topic: 'spec-rendering';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const renderSpecRenderingAngularModule: CockpitCapabilityModule = {
  id: 'render-spec-rendering-angular',
  manifestIdentity: {
    product: 'render',
    section: 'core-capabilities',
    topic: 'spec-rendering',
    page: 'overview',
    language: 'angular',
  },
  title: 'Render Spec Rendering (Angular)',
  docsPath: '/docs/render/core-capabilities/spec-rendering/overview/angular',
  promptAssetPaths: ['cockpit/render/spec-rendering/angular/prompts/spec-rendering.md'],
  codeAssetPaths: ['cockpit/render/spec-rendering/angular/src/app/spec-rendering.component.ts'],
};
