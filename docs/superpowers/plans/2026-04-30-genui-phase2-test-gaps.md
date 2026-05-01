# Generative UI Phase 2 — Test Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unit-test coverage for the two `cockpit/chat/generative-ui/angular/` view components shipped in PR #127 (`9b621521`) without specs — `ContainerComponent` and `DashboardGridComponent` — so all six dashboard views meet the example's testing convention.

**Architecture:** Two new `*.spec.ts` files following the existing pattern in `views/stat-card.component.spec.ts` and `views/bar-chart.component.spec.ts`: `TestBed`-instantiated standalone component + `componentRef.setInput()` for input wiring + DOM assertions. Both target components import `RenderElementComponent`, which calls `inject(RENDER_CONTEXT)` and would throw NG0201 if instantiated by TestBed; the specs use `TestBed.overrideComponent(...).remove/add({ imports })` to swap in a local `StubRenderElementComponent` that matches `<render-element>`'s selector and public inputs. No backend, no service mocks.

**Tech Stack:** Angular 21 standalone components, `@angular/build:unit-test` runner (already configured at `cockpit/chat/generative-ui/angular/project.json`), `@angular/core/testing` `TestBed`/`ComponentFixture`.

**Out of scope (deliberately deferred):**
- E2E "send 'show me the dashboard' → assert stat-card visible" — needs live LangGraph backend; warrants its own plan with CI plumbing.
- Landing the stranded `backup/genui-phase2-docs` design+plan — superseded by post-refactor specs (`2026-04-21-chat-runtime-decoupling-design`, `2026-04-25-events-on-agent-contract-design`); branch should be deleted after this PR merges.
- Adding skeleton/loading state to `ContainerComponent` or `DashboardGridComponent` — neither component owns rendered data; skeleton state is the responsibility of leaf views (`stat_card`, `line_chart`, `bar_chart`, `data_grid`), which are already tested.

---

## File Structure

### New files
- `cockpit/chat/generative-ui/angular/src/app/views/container.component.spec.ts`
- `cockpit/chat/generative-ui/angular/src/app/views/dashboard-grid.component.spec.ts`

### Modified files
- None.

### Deleted files
- None. (Backup branch `backup/genui-phase2-docs` is git-administrative cleanup, handled outside this plan.)

---

## Reference Implementations Under Test

For context while writing the specs (do not modify these files):

`cockpit/chat/generative-ui/angular/src/app/views/container.component.ts`:
```ts
// SPDX-License-Identifier: MIT
import { Component, computed, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@ngaf/render';

@Component({
  selector: 'app-container',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div [class]="layoutClass()">
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </div>
  `,
})
export class ContainerComponent {
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
  readonly direction = input<'row' | 'column'>('column');

  readonly layoutClass = computed(() =>
    this.direction() === 'row'
      ? 'flex flex-row flex-wrap gap-3'
      : 'flex flex-col gap-3'
  );
}
```

`cockpit/chat/generative-ui/angular/src/app/views/dashboard-grid.component.ts`:
```ts
// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@ngaf/render';

@Component({
  selector: 'app-dashboard-grid',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div class="flex flex-col gap-6 p-4">
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </div>
  `,
})
export class DashboardGridComponent {
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
}
```

Both components delegate child rendering to `<render-element>` and expose only structural inputs. Tests therefore assert:
1. The wrapping `<div>` carries the correct layout class.
2. The expected number of `<render-element>` children are emitted (one per `childKeys` entry).
3. `ContainerComponent` switches the layout class when `direction` toggles.

---

## Task 1: Add `ContainerComponent` spec

**Files:**
- Create: `cockpit/chat/generative-ui/angular/src/app/views/container.component.spec.ts`

- [ ] **Step 1: Write the failing test file**

Create `cockpit/chat/generative-ui/angular/src/app/views/container.component.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RenderElementComponent } from '@ngaf/render';
import { ContainerComponent } from './container.component';

// Stub matching <render-element>'s selector + public inputs. Swapped into
// ContainerComponent's imports via overrideComponent so Angular doesn't
// instantiate the real RenderElementComponent (which requires RENDER_CONTEXT).
@Component({
  selector: 'render-element',
  standalone: true,
  template: '',
})
class StubRenderElementComponent {
  readonly elementKey = input<string>('');
  readonly spec = input<Spec | undefined>(undefined);
}

describe('ContainerComponent', () => {
  let fixture: ComponentFixture<ContainerComponent>;

  // Minimal Spec satisfying the input.required<Spec>() — children resolution
  // is delegated to <render-element>, so the spec body itself is not exercised.
  const emptySpec: Spec = { elements: {}, root: 'root' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContainerComponent],
    })
      .overrideComponent(ContainerComponent, {
        remove: { imports: [RenderElementComponent] },
        add: { imports: [StubRenderElementComponent] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(ContainerComponent);
  });

  it('applies column flex classes by default', () => {
    fixture.componentRef.setInput('spec', emptySpec);
    fixture.detectChanges();
    const wrapper = fixture.nativeElement.querySelector('div');
    expect(wrapper?.className).toContain('flex-col');
    expect(wrapper?.className).not.toContain('flex-row');
  });

  it('applies row flex classes when direction is "row"', () => {
    fixture.componentRef.setInput('spec', emptySpec);
    fixture.componentRef.setInput('direction', 'row');
    fixture.detectChanges();
    const wrapper = fixture.nativeElement.querySelector('div');
    expect(wrapper?.className).toContain('flex-row');
    expect(wrapper?.className).not.toContain('flex-col');
  });

  it('renders one render-element per childKey', () => {
    fixture.componentRef.setInput('spec', emptySpec);
    fixture.componentRef.setInput('childKeys', ['a', 'b', 'c']);
    fixture.detectChanges();
    const elements = fixture.nativeElement.querySelectorAll('render-element');
    expect(elements.length).toBe(3);
  });

  it('renders no render-element children when childKeys is empty', () => {
    fixture.componentRef.setInput('spec', emptySpec);
    fixture.componentRef.setInput('childKeys', []);
    fixture.detectChanges();
    const elements = fixture.nativeElement.querySelectorAll('render-element');
    expect(elements.length).toBe(0);
  });
});
```

> **Why the stub:** `RenderElementComponent` is a standalone component imported by `ContainerComponent`. When Angular sees `<render-element>` in the rendered template, it instantiates the real component, which calls `inject(RENDER_CONTEXT)` — a non-optional injection that throws `NG0201` in a TestBed without the full render pipeline wired up. `TestBed.overrideComponent(...).remove/add({ imports })` swaps in a stub matching the selector + inputs so DOM assertions on `<render-element>` count still work, but nothing tries to render real elements. This is the standard Angular pattern for testing layout wrappers in isolation.

- [ ] **Step 2: Run the test to verify it passes**

Run: `npx nx test cockpit-chat-generative-ui-angular --test-path-pattern=container.component.spec`
Expected: 4 tests pass.

If the test runner doesn't filter by path pattern, run the full project test target:
Run: `npx nx test cockpit-chat-generative-ui-angular`
Expected: all existing specs pass + 4 new ContainerComponent tests pass.

- [ ] **Step 3: Commit**

```bash
git add cockpit/chat/generative-ui/angular/src/app/views/container.component.spec.ts
git commit -m "test(cockpit): cover ContainerComponent layout and child rendering"
```

---

## Task 2: Add `DashboardGridComponent` spec

**Files:**
- Create: `cockpit/chat/generative-ui/angular/src/app/views/dashboard-grid.component.spec.ts`

- [ ] **Step 1: Write the failing test file**

Create `cockpit/chat/generative-ui/angular/src/app/views/dashboard-grid.component.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RenderElementComponent } from '@ngaf/render';
import { DashboardGridComponent } from './dashboard-grid.component';

// See ContainerComponent spec for rationale. Same stub pattern keeps Angular
// from instantiating the real <render-element> (which needs RENDER_CONTEXT).
@Component({
  selector: 'render-element',
  standalone: true,
  template: '',
})
class StubRenderElementComponent {
  readonly elementKey = input<string>('');
  readonly spec = input<Spec | undefined>(undefined);
}

describe('DashboardGridComponent', () => {
  let fixture: ComponentFixture<DashboardGridComponent>;

  const emptySpec: Spec = { elements: {}, root: 'root' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardGridComponent],
    })
      .overrideComponent(DashboardGridComponent, {
        remove: { imports: [RenderElementComponent] },
        add: { imports: [StubRenderElementComponent] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(DashboardGridComponent);
  });

  it('applies vertical flex layout with section spacing', () => {
    fixture.componentRef.setInput('spec', emptySpec);
    fixture.detectChanges();
    const wrapper = fixture.nativeElement.querySelector('div');
    expect(wrapper?.className).toContain('flex-col');
    expect(wrapper?.className).toContain('gap-6');
  });

  it('renders one render-element per childKey', () => {
    fixture.componentRef.setInput('spec', emptySpec);
    fixture.componentRef.setInput('childKeys', ['stats_row', 'charts_row', 'table_section']);
    fixture.detectChanges();
    const elements = fixture.nativeElement.querySelectorAll('render-element');
    expect(elements.length).toBe(3);
  });

  it('renders no render-element children when childKeys is empty', () => {
    fixture.componentRef.setInput('spec', emptySpec);
    fixture.componentRef.setInput('childKeys', []);
    fixture.detectChanges();
    const elements = fixture.nativeElement.querySelectorAll('render-element');
    expect(elements.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `npx nx test cockpit-chat-generative-ui-angular`
Expected: full project test target green, including the 3 new DashboardGridComponent tests.

- [ ] **Step 3: Commit**

```bash
git add cockpit/chat/generative-ui/angular/src/app/views/dashboard-grid.component.spec.ts
git commit -m "test(cockpit): cover DashboardGridComponent layout and child rendering"
```

---

## Task 3: Verify whole-project test suite + lint

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit test suite for the example app**

Run: `npx nx test cockpit-chat-generative-ui-angular`
Expected: every spec under `cockpit/chat/generative-ui/angular/src/app/views/` passes — 4 existing (`stat-card`, `line-chart`, `bar-chart`, `data-grid`) + 2 new (`container`, `dashboard-grid`).

- [ ] **Step 2: Run lint on touched files**

Run: `npx nx lint cockpit-chat-generative-ui-angular`
Expected: no errors. If lint is not configured for this project, skip.

- [ ] **Step 3 (optional): Run the broader test sweep used by CI**

Run: `npx nx affected -t test --base=origin/main`
Expected: passes — new specs are leaf-only and shouldn't ripple.

If green, the branch is ready to push and PR.

---

## Self-Review Checklist

Run before opening the PR:

- [ ] Both new spec files exist at the paths above and import `Spec` from `@json-render/core`.
- [ ] Test names describe behavior (layout class, child count), not implementation.
- [ ] `RenderElementComponent` is imported only as the override target so a local `StubRenderElementComponent` (matching selector + public inputs) takes its place — assertions still inspect the rendered `<render-element>` selector strings.
- [ ] No service mocks; the only test double is the local `StubRenderElementComponent` that shields TestBed from the real component's `RENDER_CONTEXT` injection.
- [ ] License header `// SPDX-License-Identifier: MIT` is present on both files.
- [ ] `npx nx test cockpit-chat-generative-ui-angular` passes with all view specs green.

---

## Execution Handoff

Branch: `test/genui-phase2-view-coverage` (cut from `main`).

Recommended path: subagent-driven-development — two leaf tasks + one verification task is well-scoped for fresh-context implementer dispatches with two-stage review per task.
