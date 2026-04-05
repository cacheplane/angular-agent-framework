// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Types
export type {
  AngularComponentInputs,
  AngularComponentRenderer,
  AngularRegistry,
  RenderConfig,
} from './lib/render.types';

// Contexts
export { RENDER_CONTEXT } from './lib/contexts/render-context';
export type { RenderContext } from './lib/contexts/render-context';
export { REPEAT_SCOPE } from './lib/contexts/repeat-scope';
export type { RepeatScope } from './lib/contexts/repeat-scope';

// Registry
export { defineAngularRegistry } from './lib/define-angular-registry';

// State
export { signalStateStore } from './lib/signal-state-store';

// Provider
export { provideRender, RENDER_CONFIG } from './lib/provide-render';

// Components
export { RenderElementComponent } from './lib/render-element.component';
export { RenderSpecComponent } from './lib/render-spec.component';
