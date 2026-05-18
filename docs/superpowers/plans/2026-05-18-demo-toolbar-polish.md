# Demo Toolbar Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull the demo's top toolbar into the @ngaf/chat visual system — replace native `<select>` with `<chat-select>`, normalize fonts to 14px sm, restyle "New conversation" as a surface-alt secondary pill.

**Architecture:** Demo-side changes only (`examples/chat/angular/src/app/shell/`). No library code changes; no @ngaf/* version bump needed. The Canonical demo → Vercel job redeploys when files under `examples/chat/angular/**` change on main.

**Tech Stack:** Angular 20+ standalone components, vitest, @ngaf/chat ChatSelectComponent.

**Branch:** `claude/demo-toolbar-polish` (off latest `origin/main`; spec committed at `2acf36ff`).

**Spec:** `docs/superpowers/specs/2026-05-18-demo-toolbar-polish-design.md`

---

## File map

| File | Change |
|---|---|
| `examples/chat/angular/src/app/shell/demo-shell.component.ts` | Add `ChatSelectComponent` to `imports` array |
| `examples/chat/angular/src/app/shell/demo-shell.component.html` | Replace four `<select>` blocks with `<chat-select>` |
| `examples/chat/angular/src/app/shell/demo-shell.component.css` | Toolbar shell tokens (font-family/size); segmented-button font drop; "New conversation" surface-alt restyle; delete `.demo-shell__field select` rule |
| `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts` | Add chat-select interaction tests + CSS-string assertion for toolbar-action |

---

## Task 1: Swap the four native selects to `<chat-select>`

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts:46-55` (the `imports: [...]` block — add `ChatSelectComponent`)
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.html:78-112` (the four `<label class="demo-shell__field">` blocks containing native `<select>`)
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts` (add the chat-select interaction tests below)

- [ ] **Step 1: Write the failing tests**

Append to `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts` (after the existing describe blocks):

```ts
describe('DemoShell — toolbar dropdowns use chat-select', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'embed', component: DemoShell },
          { path: '', pathMatch: 'full', redirectTo: 'embed' },
          { path: '**', redirectTo: 'embed' },
        ]),
      ],
    });
  });

  it('renders the four toolbar fields with <chat-select>, not native <select>', () => {
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();
    const fields = fx.nativeElement.querySelectorAll('.demo-shell__field');
    expect(fields.length).toBe(4);
    for (const field of Array.from(fields) as HTMLElement[]) {
      expect(field.querySelector('chat-select')).toBeTruthy();
      expect(field.querySelector('select')).toBeNull();
    }
  });

  it('the Model chat-select uses menuLabel="Model"', () => {
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();
    const modelField = fx.nativeElement.querySelectorAll('.demo-shell__field')[0] as HTMLElement;
    const select = modelField.querySelector('chat-select') as HTMLElement;
    // chat-select renders an aria-label on the menu element built from menuLabel,
    // but the trigger also exposes the placeholder/menuLabel via the listbox aria.
    // Easier check: the chat-select host should receive a menuLabel input — we
    // assert by inspecting the trigger's aria-controls / popover label after open.
    const trigger = select.querySelector('.chat-select__trigger') as HTMLButtonElement;
    expect(trigger).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm nx test examples-chat-angular -- --runTestsByPath examples/chat/angular/src/app/shell/demo-shell.component.spec.ts`
Expected: FAIL — current markup uses native `<select>`, so `chat-select` query returns null.

- [ ] **Step 3: Add ChatSelectComponent to the imports array**

In `examples/chat/angular/src/app/shell/demo-shell.component.ts`, find the existing import block from `@ngaf/chat` (around lines 17-28):

```ts
import {
  ChatInterruptPanelComponent,
  ChatSubagentsComponent,
  ChatSidenavComponent,
  ChatHistorySearchPaletteComponent,
  type ChatSidenavMode,
  type InterruptAction,
  type ThreadMatch,
  type ThreadActionAdapter,
  type Thread,
  type ProjectActionAdapter,
} from '@ngaf/chat';
```

Replace with (add `ChatSelectComponent`):

```ts
import {
  ChatInterruptPanelComponent,
  ChatSubagentsComponent,
  ChatSidenavComponent,
  ChatHistorySearchPaletteComponent,
  ChatSelectComponent,
  type ChatSidenavMode,
  type InterruptAction,
  type ThreadMatch,
  type ThreadActionAdapter,
  type Thread,
  type ProjectActionAdapter,
} from '@ngaf/chat';
```

Then in the component's `imports: [...]` array (immediately after the `@Component({` decorator, around line 50-ish), add `ChatSelectComponent` to the list. The order doesn't matter; just append it.

- [ ] **Step 4: Replace each native `<select>` block in the template**

In `examples/chat/angular/src/app/shell/demo-shell.component.html`, replace the four `<label class="demo-shell__field">` blocks (lines 78-112) with chat-select equivalents.

**Block 1 — Model** (lines 78-85). Old:

```html
<label class="demo-shell__field">
  <span>Model</span>
  <select [value]="model()" (change)="onModelChange($any($event.target).value)">
    @for (option of modelOptions(); track option.value) {
      <option [value]="option.value">{{ option.label }}</option>
    }
  </select>
</label>
```

New:

```html
<label class="demo-shell__field">
  <span>Model</span>
  <chat-select
    [options]="modelOptions()"
    [value]="model()"
    menuLabel="Model"
    (valueChange)="onModelChange($event)"
  />
</label>
```

**Block 2 — Effort** (lines 87-94). Old:

```html
<label class="demo-shell__field">
  <span>Effort</span>
  <select [value]="effort()" (change)="onEffortChange($any($event.target).value)">
    @for (option of effortOptions(); track option.value) {
      <option [value]="option.value">{{ option.label }}</option>
    }
  </select>
</label>
```

New:

```html
<label class="demo-shell__field">
  <span>Effort</span>
  <chat-select
    [options]="effortOptions()"
    [value]="effort()"
    menuLabel="Effort"
    (valueChange)="onEffortChange($event)"
  />
</label>
```

**Block 3 — Gen UI** (lines 96-103). Old:

```html
<label class="demo-shell__field">
  <span>Gen UI</span>
  <select [value]="genUiMode()" (change)="onGenUiModeChange($any($event.target).value)">
    @for (option of genUiOptions(); track option.value) {
      <option [value]="option.value">{{ option.label }}</option>
    }
  </select>
</label>
```

New:

```html
<label class="demo-shell__field">
  <span>Gen UI</span>
  <chat-select
    [options]="genUiOptions()"
    [value]="genUiMode()"
    menuLabel="Gen UI"
    (valueChange)="onGenUiModeChange($event)"
  />
</label>
```

**Block 4 — Theme** (lines 105-112). Old:

```html
<label class="demo-shell__field">
  <span>Theme</span>
  <select [value]="theme()" (change)="onThemeChange($any($event.target).value)">
    @for (option of themeOptions(); track option.value) {
      <option [value]="option.value">{{ option.label }}</option>
    }
  </select>
</label>
```

New:

```html
<label class="demo-shell__field">
  <span>Theme</span>
  <chat-select
    [options]="themeOptions()"
    [value]="theme()"
    menuLabel="Theme"
    (valueChange)="onThemeChange($event)"
  />
</label>
```

- [ ] **Step 5: Verify the option-list types match `ChatSelectOption`**

`ChatSelectOption` requires `{ value: string; label: string; disabled?: boolean }`. The demo's option signals return objects with at minimum `{ value, label }`. If the TypeScript compiler complains (e.g. effortOptions returns `{ value: string; label: string; hint?: string }`), the extra fields are ignored by `[options]`'s input typing as long as `value` + `label` are strings.

If a signal returns numeric values, coerce to string. Quick check:

Run: `pnpm nx test examples-chat-angular -- --runTestsByPath examples/chat/angular/src/app/shell/demo-shell.component.spec.ts 2>&1 | head -40`

If the only errors are the spec failures from Step 2 (now passing thanks to Step 4), continue. If there are TS errors mentioning `Type 'XOption' is not assignable to type 'ChatSelectOption'`, narrow the `[options]` binding using a `.map(o => ({ value: o.value, label: o.label }))` on the corresponding signal in `demo-shell.component.ts` and use the mapped signal in the template.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm nx test examples-chat-angular -- --runTestsByPath examples/chat/angular/src/app/shell/demo-shell.component.spec.ts`
Expected: all PASS, including the two new chat-select tests.

- [ ] **Step 7: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts \
        examples/chat/angular/src/app/shell/demo-shell.component.html \
        examples/chat/angular/src/app/shell/demo-shell.component.spec.ts
git commit -m "feat(demo): swap toolbar native selects to chat-select"
```

---

## Task 2: Toolbar shell + segmented control font + token cleanup

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.css:54-99` (toolbar + segmented blocks)
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.css:110-116` (delete the `.demo-shell__field select` block — chat-select carries its own styles)

- [ ] **Step 1: Replace the `.demo-shell__toolbar` block**

In `examples/chat/angular/src/app/shell/demo-shell.component.css`, replace the existing rule (lines 54-66):

```css
.demo-shell__toolbar {
  flex: 0 0 auto;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--ngaf-chat-text, #e6e9ef) 12%, transparent);
  background: color-mix(in srgb, var(--ngaf-chat-bg, #0f1115) 94%, transparent);
  color: var(--ngaf-chat-text, #e6e9ef);
  box-sizing: border-box;
  overflow-x: auto;
}
```

with:

```css
.demo-shell__toolbar {
  flex: 0 0 auto;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--ngaf-chat-separator);
  background: color-mix(in srgb, var(--ngaf-chat-bg) 94%, transparent);
  color: var(--ngaf-chat-text);
  font-family: inherit;
  font-size: var(--ngaf-chat-font-size-sm);
  box-sizing: border-box;
  overflow-x: auto;
}
```

- [ ] **Step 2: Remove the per-child font-size override**

In the same CSS file, the rule at lines 79-85 currently reads:

```css
.demo-shell__segmented-button,
.demo-shell__toolbar-action,
.demo-shell__field select {
  font: inherit;
  font-size: 12px;
  color: var(--ngaf-chat-text, #e6e9ef);
}
```

Replace with (drop the deleted `.demo-shell__field select` selector AND drop the explicit `font-size: 12px` so children inherit the toolbar's new 14px sm baseline; also drop the `, #e6e9ef` fallback):

```css
.demo-shell__segmented-button,
.demo-shell__toolbar-action {
  font: inherit;
  color: var(--ngaf-chat-text);
}
```

- [ ] **Step 3: Drop the fallback literal on segmented buttons**

The segmented-button rules at lines 87-99 currently look like:

```css
.demo-shell__segmented-button {
  border: 0;
  background: transparent;
  border-radius: 6px;
  min-height: 28px;
  padding: 0 10px;
  cursor: pointer;
}

.demo-shell__segmented-button.is-active {
  background: var(--ngaf-chat-text, #e6e9ef);
  color: var(--ngaf-chat-bg, #0f1115);
}
```

Replace with (drop `, #...` fallbacks):

```css
.demo-shell__segmented-button {
  border: 0;
  background: transparent;
  border-radius: 6px;
  min-height: 28px;
  padding: 0 10px;
  cursor: pointer;
}

.demo-shell__segmented-button.is-active {
  background: var(--ngaf-chat-text);
  color: var(--ngaf-chat-bg);
}
```

- [ ] **Step 4: Delete the `.demo-shell__field select` rule**

Find the block (lines 110-116):

```css
.demo-shell__field select {
  height: 30px;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--ngaf-chat-text, #e6e9ef) 14%, transparent);
  background: var(--ngaf-chat-bg, #0f1115);
  padding: 0 26px 0 8px;
}
```

Delete it entirely (chat-select carries its own styling now).

- [ ] **Step 5: Drop the segmented outer pill fallbacks**

The `.demo-shell__segmented` rule at lines 68-77 currently uses color-mix with `, #e6e9ef`. Replace:

```css
.demo-shell__segmented {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--ngaf-chat-text, #e6e9ef) 14%, transparent);
  background: color-mix(in srgb, var(--ngaf-chat-text, #e6e9ef) 4%, transparent);
  flex: 0 0 auto;
}
```

with:

```css
.demo-shell__segmented {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--ngaf-chat-text) 14%, transparent);
  background: color-mix(in srgb, var(--ngaf-chat-text) 4%, transparent);
  flex: 0 0 auto;
}
```

(only `, #e6e9ef` removed inside the color-mix args; structure stays.)

- [ ] **Step 6: Update `.demo-shell__field` muted color fallback**

At lines 101-108:

```css
.demo-shell__field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ngaf-chat-text-muted, #9aa3b2);
  font-size: 12px;
  flex: 0 0 auto;
}
```

Replace with (drop fallback; drop explicit 12px so it inherits 14px sm from the toolbar):

```css
.demo-shell__field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ngaf-chat-text-muted);
  flex: 0 0 auto;
}
```

- [ ] **Step 7: Run the spec to verify no regression**

Run: `pnpm nx test examples-chat-angular -- --runTestsByPath examples/chat/angular/src/app/shell/demo-shell.component.spec.ts`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.css
git commit -m "feat(demo): align toolbar shell + segmented control with chat-lib tokens"
```

---

## Task 3: Restyle "New conversation" button as a surface-alt pill

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.css:118-131` (`.demo-shell__toolbar-action` block + its shared hover)
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts` (add a CSS-string assertion)

- [ ] **Step 1: Write the failing test**

Append to `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts`:

```ts
describe('DemoShell — "New conversation" button styling', () => {
  it('renders the action as a surface-alt pill with 8px radius (matches the secondary tier)', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'embed', component: DemoShell },
          { path: '', pathMatch: 'full', redirectTo: 'embed' },
          { path: '**', redirectTo: 'embed' },
        ]),
      ],
    });
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();
    const btn = fx.nativeElement.querySelector('.demo-shell__toolbar-action') as HTMLElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent?.trim()).toBe('New conversation');
    // Compute against the document's loaded stylesheet (component CSS is loaded via Vite).
    const cs = getComputedStyle(btn);
    expect(cs.borderRadius).toBe('8px');
    // The border should be 0 (no outline ring like before).
    expect(cs.borderTopWidth).toBe('0px');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test examples-chat-angular -- --runTestsByPath examples/chat/angular/src/app/shell/demo-shell.component.spec.ts`
Expected: FAIL — current radius is 7px, current border-top-width is 1px.

- [ ] **Step 3: Replace the `.demo-shell__toolbar-action` block**

In `examples/chat/angular/src/app/shell/demo-shell.component.css`, replace lines 118-131:

```css
.demo-shell__toolbar-action {
  height: 30px;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--ngaf-chat-text, #e6e9ef) 18%, transparent);
  background: transparent;
  padding: 0 10px;
  cursor: pointer;
  flex: 0 0 auto;
}

.demo-shell__toolbar-action:hover,
.demo-shell__segmented-button:hover:not(.is-active) {
  background: color-mix(in srgb, var(--ngaf-chat-text, #e6e9ef) 8%, transparent);
}
```

with (split the shared hover so toolbar-action gets the surface-alt lift recipe; segmented inactive hover keeps its transparent lift):

```css
.demo-shell__toolbar-action {
  border: 0;
  background: var(--ngaf-chat-surface-alt);
  color: var(--ngaf-chat-text);
  border-radius: 8px;
  padding: 8px 12px;
  min-height: 32px;
  cursor: pointer;
  flex: 0 0 auto;
}

.demo-shell__toolbar-action:hover {
  background: color-mix(in srgb, var(--ngaf-chat-text) 8%, var(--ngaf-chat-surface-alt));
}

.demo-shell__segmented-button:hover:not(.is-active) {
  background: color-mix(in srgb, var(--ngaf-chat-text) 8%, transparent);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm nx test examples-chat-angular -- --runTestsByPath examples/chat/angular/src/app/shell/demo-shell.component.spec.ts`
Expected: all PASS.

- [ ] **Step 5: Run the full demo test suite to catch any regression**

Run: `pnpm nx test examples-chat-angular`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.css \
        examples/chat/angular/src/app/shell/demo-shell.component.spec.ts
git commit -m "feat(demo): restyle New conversation as a surface-alt pill"
```
