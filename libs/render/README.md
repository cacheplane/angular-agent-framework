# @threadplane/render

`@json-render/core`-backed Angular render engine — maps JSON specs to Angular components via a registry, used internally by `@threadplane/chat` for generative-UI rendering.

<p>
  <a href="https://www.npmjs.com/package/@threadplane/render">
    <img alt="npm version" src="https://img.shields.io/npm/v/@threadplane%2Frender?color=6C8EFF&labelColor=080B14&style=flat-square" />
  </a>
  <a href="https://angular.dev">
    <img alt="Angular 20+" src="https://img.shields.io/badge/Angular-20%2B%20%7C%2021-6C8EFF?labelColor=080B14&style=flat-square" />
  </a>
  <a href="../../LICENSE">
    <img alt="MIT" src="https://img.shields.io/badge/License-MIT-6C8EFF?labelColor=080B14&style=flat-square" />
  </a>
</p>

## What it does

- Renders a JSON spec tree to Angular components via a named view registry (`<render-spec>`) or a single node (`<render-element>`).
- Registry composition utilities (`views`, `withViews`, `withoutViews`) let you build, extend, and trim registries without mutation.
- Signal-based state store (`signalStateStore`) and per-component fallback support keep UI consistent during streaming.

## Install

```bash
npm install @threadplane/render
```

**Peer dependencies:** `@angular/core ^20.0.0 || ^21.0.0`, `@angular/common ^20.0.0 || ^21.0.0`, `@json-render/core ^0.16.0`

## Quick start

**1. Define your view registry and provide it.**

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRender, provideViews, views, toRenderRegistry } from '@threadplane/render';
import { CardComponent } from './card.component';
import { HeroComponent } from './hero.component';

const myRegistry = toRenderRegistry(
  views({ card: CardComponent, hero: HeroComponent })
);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRender({ registry: myRegistry }),
  ],
};
```

**2. Render a spec in your component.**

```typescript
import { Component, signal } from '@angular/core';
import { RenderSpecComponent } from '@threadplane/render';
import type { Spec } from '@json-render/core';

@Component({
  selector: 'app-agent-ui',
  imports: [RenderSpecComponent],
  template: `<render-spec [spec]="spec()" />`,
})
export class AgentUiComponent {
  spec = signal<Spec | null>(null);

  onAgentMessage(incoming: Spec) {
    this.spec.set(incoming);
  }
}
```

## Capabilities

**View registry composition** — `views(map)` creates a frozen registry; `withViews(base, additions)` extends it non-destructively; `withoutViews(base, ...keys)` prunes entries. Convert to an `AngularRegistry` with `toRenderRegistry` and supply it app-wide via `provideRender({ registry })`, or pass one directly as the `[registry]` input on `<render-spec>` / `<render-element>`.

**Signal state store** — `signalStateStore(initialState?)` provides a `StateStore` backed by Angular Signals, suitable for two-way bindings declared in a spec.

**DI providers** — `provideRender(config)` registers `RenderConfig` (registry, store, functions, handlers) as environment-scoped defaults read by the render components; `provideViews(registry)` publishes a `ViewRegistry` under the `VIEW_REGISTRY` token for consumers to inject directly.

**Fallback** — `DefaultFallbackComponent` renders when no component is registered for a spec node; individual entries in a `ViewRegistry` can supply their own `fallback` component via `RenderViewEntry`.

## Reliability

Powers `@threadplane/chat` generative-UI rendering in production. Patch-only `0.0.x` releases. Validated by the CI job "Library — lint / test / build" on every commit.

## License

MIT. See [LICENSE](../../LICENSE).
