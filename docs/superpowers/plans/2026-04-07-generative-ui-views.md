# Generative UI Views System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `views()` functional API to `@cacheplane/render` and wire it into `@cacheplane/chat` so agents can produce JSON specs that render as interactive Angular components inline in the chat.

**Architecture:** `views()` creates an immutable registry mapping names to Angular components. The chat component detects UI specs in messages (tool results, state, metadata), converts the view registry to an `AngularRegistry`, and passes specs to `<render-spec>` for recursive rendering. `signalStateStore()` handles two-way interactivity.

**Tech Stack:** Angular 20+, `@json-render/core`, `@cacheplane/render`, `@cacheplane/chat`, Vitest

---

## File Structure

### New files
- `libs/render/src/lib/views.ts` — `views()`, `withViews()`, `withoutViews()`, `ViewRegistry` type
- `libs/render/src/lib/views.spec.ts` — unit tests for view registry operations
- `libs/render/src/lib/provide-views.ts` — `provideViews()`, `VIEW_REGISTRY` token

### Modified files
- `libs/render/src/public-api.ts` — export new views API
- `libs/chat/src/lib/provide-chat.ts` — add `views` to `ChatConfig`
- `libs/chat/src/lib/compositions/chat/chat.component.ts` — add `[views]`, `[store]`, `(action)` inputs/outputs, render inline specs
- `libs/chat/src/lib/primitives/chat-messages/chat-messages.component.ts` — add `[views]`, `[store]` inputs, detect and render UI specs per message
- `libs/chat/src/public-api.ts` — re-export views API

---

## Task 1: views() Functional API

**Files:**
- Create: `libs/render/src/lib/views.ts`
- Create: `libs/render/src/lib/views.spec.ts`

- [ ] **Step 1: Write failing tests for views(), withViews(), withoutViews()**

```typescript
// libs/render/src/lib/views.spec.ts
import { describe, it, expect } from 'vitest';
import { Component } from '@angular/core';
import { views, withViews, withoutViews } from './views';

@Component({ selector: 'test-a', standalone: true, template: 'A' })
class CompA {}

@Component({ selector: 'test-b', standalone: true, template: 'B' })
class CompB {}

@Component({ selector: 'test-c', standalone: true, template: 'C' })
class CompC {}

describe('views()', () => {
  it('creates a frozen registry from a map', () => {
    const reg = views({ 'a': CompA, 'b': CompB });
    expect(reg['a']).toBe(CompA);
    expect(reg['b']).toBe(CompB);
    expect(Object.isFrozen(reg)).toBe(true);
  });

  it('composes via spread (last key wins)', () => {
    const base = views({ 'a': CompA });
    const override = views({ ...base, 'a': CompB });
    expect(override['a']).toBe(CompB);
  });
});

describe('withViews()', () => {
  it('adds new entries without overwriting existing', () => {
    const base = views({ 'a': CompA });
    const extended = withViews(base, { 'b': CompB, 'a': CompC });
    expect(extended['a']).toBe(CompA); // preserved
    expect(extended['b']).toBe(CompB); // added
  });

  it('returns a frozen registry', () => {
    const result = withViews(views({}), { 'a': CompA });
    expect(Object.isFrozen(result)).toBe(true);
  });
});

describe('withoutViews()', () => {
  it('removes named entries', () => {
    const base = views({ 'a': CompA, 'b': CompB, 'c': CompC });
    const result = withoutViews(base, 'b', 'c');
    expect(result['a']).toBe(CompA);
    expect(result['b']).toBeUndefined();
    expect(result['c']).toBeUndefined();
  });

  it('returns a frozen registry', () => {
    const result = withoutViews(views({ 'a': CompA }), 'a');
    expect(Object.isFrozen(result)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run --config libs/render/vite.config.mts
```

Expected: FAIL — `views`, `withViews`, `withoutViews` not found.

- [ ] **Step 3: Implement views(), withViews(), withoutViews()**

```typescript
// libs/render/src/lib/views.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Type } from '@angular/core';
import type { AngularRegistry } from './render.types';
import { defineAngularRegistry } from './define-angular-registry';

/**
 * A registry of view components available for generative UI rendering.
 * Plain frozen object mapping view names to Angular component types.
 * Compose via object spread: `views({ ...base, ...more })`.
 */
export type ViewRegistry = Readonly<Record<string, Type<unknown>>>;

/**
 * Creates a view registry from a name → component map.
 *
 * @example
 * ```typescript
 * const ui = views({
 *   'plan-checklist': PlanChecklistComponent,
 *   'file-preview': FilePreviewComponent,
 * });
 * ```
 */
export function views(map: Record<string, Type<unknown>>): ViewRegistry {
  return Object.freeze({ ...map });
}

/**
 * Adds views to a registry without overwriting existing entries.
 * New keys are added; keys that already exist in `base` are preserved.
 *
 * @example
 * ```typescript
 * const extended = withViews(base, { 'chart': ChartComponent });
 * ```
 */
export function withViews(
  base: ViewRegistry,
  additions: Record<string, Type<unknown>>,
): ViewRegistry {
  return Object.freeze({ ...additions, ...base });
}

/**
 * Removes views from a registry by name.
 *
 * @example
 * ```typescript
 * const restricted = withoutViews(base, 'file-preview', 'code-output');
 * ```
 */
export function withoutViews(
  base: ViewRegistry,
  ...names: string[]
): ViewRegistry {
  const result = { ...base };
  for (const name of names) delete result[name];
  return Object.freeze(result);
}

/**
 * Converts a ViewRegistry to an AngularRegistry for use with RenderSpecComponent.
 * This is the bridge between the high-level views API and the low-level render API.
 */
export function toRenderRegistry(registry: ViewRegistry): AngularRegistry {
  return defineAngularRegistry(registry);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run --config libs/render/vite.config.mts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add libs/render/src/lib/views.ts libs/render/src/lib/views.spec.ts
git commit -m "feat(render): add views() functional API for generative UI registry"
```

---

## Task 2: provideViews() DI Provider

**Files:**
- Create: `libs/render/src/lib/provide-views.ts`
- Modify: `libs/render/src/public-api.ts`

- [ ] **Step 1: Create provideViews() and VIEW_REGISTRY token**

```typescript
// libs/render/src/lib/provide-views.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import type { ViewRegistry } from './views';

/**
 * Injection token for providing a ViewRegistry globally or at route level.
 */
export const VIEW_REGISTRY = new InjectionToken<ViewRegistry>('VIEW_REGISTRY');

/**
 * Provides a ViewRegistry via Angular dependency injection.
 * Use at app level for global views, or at route level for scoped views.
 *
 * @example
 * ```typescript
 * // app.config.ts
 * providers: [provideViews(agentViews)]
 *
 * // Route-level
 * { path: 'planning', providers: [provideViews(planningViews)] }
 * ```
 */
export function provideViews(registry: ViewRegistry) {
  return makeEnvironmentProviders([
    { provide: VIEW_REGISTRY, useValue: registry },
  ]);
}
```

- [ ] **Step 2: Export from public-api.ts**

Add these lines to `libs/render/src/public-api.ts`:

```typescript
// Views
export { views, withViews, withoutViews, toRenderRegistry } from './lib/views';
export type { ViewRegistry } from './lib/views';
export { provideViews, VIEW_REGISTRY } from './lib/provide-views';
```

- [ ] **Step 3: Run render library tests**

```bash
npx nx test render
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add libs/render/src/lib/provide-views.ts libs/render/src/public-api.ts
git commit -m "feat(render): add provideViews() DI provider and VIEW_REGISTRY token"
```

---

## Task 3: Chat Integration — Detect and Render UI Specs

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-messages/chat-messages.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`
- Modify: `libs/chat/src/lib/provide-chat.ts`

- [ ] **Step 1: Add spec detection utility**

Add to the bottom of `libs/chat/src/lib/primitives/chat-messages/chat-messages.component.ts`:

```typescript
/**
 * Extracts a UI spec from a message if present.
 * Checks the message's `ui` field and `additional_kwargs.ui` field.
 */
export function getUiSpec(message: BaseMessage): unknown | null {
  const msg = message as unknown as Record<string, unknown>;

  // Check direct ui field
  if (msg['ui'] && isValidSpec(msg['ui'])) {
    return msg['ui'];
  }

  // Check additional_kwargs.ui
  const kwargs = msg['additional_kwargs'] as Record<string, unknown> | undefined;
  if (kwargs?.['ui'] && isValidSpec(kwargs['ui'])) {
    return kwargs['ui'];
  }

  return null;
}

function isValidSpec(value: unknown): boolean {
  return typeof value === 'object'
    && value !== null
    && 'root' in (value as Record<string, unknown>)
    && 'elements' in (value as Record<string, unknown>);
}
```

- [ ] **Step 2: Add views and store inputs to ChatMessagesComponent**

Update `ChatMessagesComponent` to accept `views` and `store` inputs and render specs inline:

```typescript
// Add imports
import type { ViewRegistry } from '@cacheplane/render';
import type { StateStore } from '@json-render/core';
import { RenderSpecComponent } from '@cacheplane/render';
import { toRenderRegistry } from '@cacheplane/render';

// Update @Component
@Component({
  selector: 'chat-messages',
  standalone: true,
  imports: [NgTemplateOutlet, MessageTemplateDirective, RenderSpecComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (message of messages(); track $index) {
      @let template = findTemplate(getMessageType(message));
      @if (template) {
        <ng-container
          [ngTemplateOutlet]="template.templateRef"
          [ngTemplateOutletContext]="{ $implicit: message, index: $index }"
        />
      }

      @if (renderRegistry() && getUiSpec(message); as spec) {
        <div class="ml-10 mt-2">
          <render-spec
            [spec]="$any(spec)"
            [registry]="renderRegistry()!"
            [store]="store()"
          />
        </div>
      }
    }
  `,
})
export class ChatMessagesComponent {
  readonly ref = input.required<AgentRef<any, any>>();
  readonly views = input<ViewRegistry | undefined>(undefined);
  readonly store = input<StateStore | undefined>(undefined);

  readonly messageTemplates = contentChildren(MessageTemplateDirective);
  readonly messages = computed(() => this.ref().messages());
  readonly getMessageType = getMessageType;
  readonly getUiSpec = getUiSpec;

  /** Convert ViewRegistry to AngularRegistry for render-spec */
  readonly renderRegistry = computed(() => {
    const v = this.views();
    return v ? toRenderRegistry(v) : undefined;
  });

  findTemplate(type: MessageTemplateType): MessageTemplateDirective | undefined {
    return this.messageTemplates().find(t => t.chatMessageTemplate() === type);
  }
}
```

- [ ] **Step 3: Wire views and store through ChatComponent**

In `libs/chat/src/lib/compositions/chat/chat.component.ts`, add inputs and pass them to `<chat-messages>`:

```typescript
// Add imports
import type { ViewRegistry } from '@cacheplane/render';
import type { StateStore } from '@json-render/core';
import { VIEW_REGISTRY } from '@cacheplane/render';

// Add inputs to class
readonly views = input<ViewRegistry | undefined>(undefined);
readonly store = input<StateStore | undefined>(undefined);
readonly action = output<{ name: string; params: Record<string, unknown> }>();

// Inject DI-provided registry as fallback
private readonly diViews = inject(VIEW_REGISTRY, { optional: true });

// Resolved registry: input takes precedence over DI
private readonly resolvedViews = computed(() =>
  this.views() ?? this.diViews ?? undefined
);
```

Update the template's `<chat-messages>` tag:

```html
<chat-messages
  [ref]="ref()"
  [views]="resolvedViews()"
  [store]="store()"
>
```

- [ ] **Step 4: Update ChatConfig to accept views**

In `libs/chat/src/lib/provide-chat.ts`, update the interface:

```typescript
import type { ViewRegistry } from '@cacheplane/render';

export interface ChatConfig {
  /** View registry for generative UI rendering. */
  views?: ViewRegistry;
  /** Override the default AI avatar label (default: "A"). */
  avatarLabel?: string;
  /** Override the default assistant display name (default: "Assistant"). */
  assistantName?: string;
}
```

- [ ] **Step 5: Run tests**

```bash
npx nx test chat && npx nx test render
```

Expected: All tests pass.

- [ ] **Step 6: Build to verify compilation**

```bash
npx nx build chat
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/ libs/render/src/
git commit -m "feat(chat): integrate views registry for inline generative UI rendering"
```

---

## Task 4: Update Public API Exports

**Files:**
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Re-export views API from chat library**

Add to `libs/chat/src/public-api.ts`:

```typescript
// Views (re-exported from @cacheplane/render for convenience)
export { views, withViews, withoutViews, toRenderRegistry } from '@cacheplane/render';
export type { ViewRegistry } from '@cacheplane/render';
export { provideViews, VIEW_REGISTRY } from '@cacheplane/render';
```

- [ ] **Step 2: Export getUiSpec utility**

```typescript
export { getUiSpec } from './lib/primitives/chat-messages/chat-messages.component';
```

- [ ] **Step 3: Build to verify**

```bash
npx nx build chat
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/public-api.ts
git commit -m "feat(chat): export views API and getUiSpec from public API"
```

---

## Task 5: Planning Example — Interactive Checklist View

**Files:**
- Create: `cockpit/deep-agents/planning/angular/src/app/views/plan-checklist.component.ts`
- Create: `cockpit/deep-agents/planning/angular/src/app/views/checkbox-row.component.ts`
- Modify: `cockpit/deep-agents/planning/angular/src/app/planning.component.ts`

This task validates the full pipeline: views() → agent spec → inline rendering.

- [ ] **Step 1: Create PlanChecklistComponent view**

```typescript
// cockpit/deep-agents/planning/angular/src/app/views/plan-checklist.component.ts
import { Component, input } from '@angular/core';

@Component({
  selector: 'plan-checklist',
  standalone: true,
  template: `
    <div class="border rounded-xl p-4 my-2" style="border-color: var(--chat-border); background: var(--chat-bg-alt);">
      <h4 class="text-sm font-semibold mb-2" style="color: var(--chat-text);">{{ title() }}</h4>
      <ng-content />
    </div>
  `,
})
export class PlanChecklistComponent {
  readonly title = input<string>('Plan');
}
```

- [ ] **Step 2: Create CheckboxRowComponent view**

```typescript
// cockpit/deep-agents/planning/angular/src/app/views/checkbox-row.component.ts
import { Component, input, inject } from '@angular/core';
import { RENDER_CONTEXT } from '@cacheplane/render';

@Component({
  selector: 'checkbox-row',
  standalone: true,
  template: `
    <label class="flex items-center gap-2 py-1 cursor-pointer text-sm" style="color: var(--chat-text);">
      <input
        type="checkbox"
        [checked]="checked()"
        (change)="toggle()"
        class="w-4 h-4"
      />
      <span [class.line-through]="checked()" [style.opacity]="checked() ? '0.5' : '1'">
        {{ label() }}
      </span>
    </label>
  `,
})
export class CheckboxRowComponent {
  readonly label = input<string>('');
  readonly checked = input<boolean>(false);
  readonly emit = input<(event: string) => void>(() => {});

  toggle(): void {
    this.emit()('toggle');
  }
}
```

- [ ] **Step 3: Update PlanningComponent to use views**

```typescript
// cockpit/deep-agents/planning/angular/src/app/planning.component.ts
import { Component } from '@angular/core';
import { ChatComponent, views } from '@cacheplane/chat';
import { signalStateStore } from '@cacheplane/render';
import { agent } from '@cacheplane/langgraph';
import { environment } from '../environments/environment';
import { PlanChecklistComponent } from './views/plan-checklist.component';
import { CheckboxRowComponent } from './views/checkbox-row.component';

@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [ref]="stream" [views]="ui" [store]="uiStore" class="block h-screen" />`,
})
export class PlanningComponent {
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.planningAssistantId,
  });

  readonly ui = views({
    'plan-checklist': PlanChecklistComponent,
    'checkbox-row': CheckboxRowComponent,
  });

  readonly uiStore = signalStateStore({});
}
```

- [ ] **Step 4: Build to verify**

```bash
npx nx build cockpit-deep-agents-planning-angular
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add cockpit/deep-agents/planning/angular/src/app/
git commit -m "feat(cockpit): add planning example with generative UI views"
```

---

## Task 6: Build All + Final Verification

- [ ] **Step 1: Run all library tests**

```bash
npx nx test render && npx nx test chat
```

Expected: All tests pass.

- [ ] **Step 2: Build all libraries**

```bash
npx nx build render && npx nx build chat
```

Expected: Both build successfully.

- [ ] **Step 3: Build all cockpit examples**

```bash
npx nx run-many -t build --projects='cockpit-*-angular'
```

Expected: All 14 examples build.

- [ ] **Step 4: Commit any fixes**

If any builds fail, fix and commit.
