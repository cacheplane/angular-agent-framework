# Demo top toolbar polish — Design

**Status:** Approved
**Date:** 2026-05-18
**Goal:** Pull `demo-shell__toolbar` into the chat library's visual system so the top navbar reads as part of the same product surface as the sidenav and chat.

## Why now

The new top toolbar (added recently to replace the floating control palette) is the visual outlier on the demo: 12px / 16px fonts where the rest of the surface uses 14px, 6/7px radii where everything else uses 8px, four native browser `<select>` elements where the chat-input model picker uses the polished `chat-select` primitive, and an outlined "New conversation" button that matches nothing else.

## Decisions locked during brainstorming

| Area | Choice |
|---|---|
| Dropdown markup | **Replace native `<select>` with `<chat-select>`** for all four fields (Model, Effort, Gen UI, Theme) — same primitive as the chat-input model picker |
| "New conversation" button | **Secondary tier**: solid `--ngaf-chat-surface-alt` fill, no border, 8px radius — matches the New project pill in the sidenav. Keeps New chat (text-color CTA) as the singular CTA on the page. |
| Segmented control active state | **Keep current**: solid `--ngaf-chat-text` fill with `--ngaf-chat-bg` text — already matches the monochrome system from sub-project C |
| Font size baseline | 14px (`var(--ngaf-chat-font-size-sm)`) everywhere in the toolbar — replacing 12px on buttons/selects and the 16px host default |
| Border radius | 8px on all toolbar buttons/triggers — matches the polish-pass-2 sidenav baseline |
| Token fallbacks | Drop `, #e6e9ef` / `, #0f1115` fallback literals — `@ngaf/chat` tokens are always loaded in this surface |
| Translucent background | Keep `color-mix --ngaf-chat-bg 94% / transparent` and 1px separator border — works well, just clean up the syntax |

## Architecture

### Toolbar shell

`.demo-shell__toolbar` adds explicit `font-family: inherit` and `font-size: var(--ngaf-chat-font-size-sm)` at the container level. Removes the per-child `font-size: 12px` override on `.demo-shell__segmented-button`, `.demo-shell__toolbar-action`, and `.demo-shell__field select` (the last selector goes away entirely after the chat-select swap). Border-bottom uses `var(--ngaf-chat-separator)` directly. Background stays translucent via `color-mix`.

### Four dropdown swaps

In `demo-shell.component.html`, each of the four `<label class="demo-shell__field">` blocks changes from:

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

to:

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

`ChatSelectComponent` is imported in `demo-shell.component.ts` and added to the component's `imports` array. The component's `modelOptions()`, `effortOptions()`, `genUiOptions()`, `themeOptions()` signals already return `{ value, label }[]` shapes compatible with `ChatSelectOption`.

The `.demo-shell__field select` CSS rule is deleted; the chat-select primitive carries its own styling.

### Segmented control

`.demo-shell__segmented` and `.demo-shell__segmented-button`:
- Outer pill border-radius stays at 8px (already matches the system)
- Inner button border-radius stays at 6px (intentionally smaller than the outer for the nested-pill look)
- Font-size on inner buttons inherits from the toolbar's new 14px baseline — the explicit `font-size: 12px` line is removed
- Active state unchanged: solid `--ngaf-chat-text` fill with `--ngaf-chat-bg` text (already matches the monochrome system)

### "New conversation" button

`.demo-shell__toolbar-action`:
- Old: `border: 1px solid color-mix(...)`, `background: transparent`, `padding: 0 10px`, height 30, font-size 12
- New: `border: 0`, `background: var(--ngaf-chat-surface-alt)`, `color: var(--ngaf-chat-text)`, `border-radius: 8px`, `padding: 8px 12px`, font-size sm, `min-height: 32px`
- Hover: `background: color-mix(in srgb, var(--ngaf-chat-text) 8%, var(--ngaf-chat-surface-alt))` (same lift recipe used by the New project button in sub-project C)

The old `.demo-shell__toolbar-action:hover, .demo-shell__segmented-button:hover:not(.is-active)` shared hover rule splits: segmented inactive hover stays as `color-mix --ngaf-chat-text 8%`; toolbar-action gets its own hover with the new recipe.

## Files touched

### Demo (only — no library changes)

- `examples/chat/angular/src/app/shell/demo-shell.component.ts` — add `ChatSelectComponent` to `imports`
- `examples/chat/angular/src/app/shell/demo-shell.component.html` — four `<select>` → `<chat-select>` swaps
- `examples/chat/angular/src/app/shell/demo-shell.component.css` — toolbar shell tokens, segmented-button font size, "New conversation" restyle, delete `.demo-shell__field select` rule

### Tests

- `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts` — UPDATE existing select-interaction tests to drive `chat-select` instead of native `<select>` (open trigger, click option, assert handler called). Add a CSS-string assertion that `.demo-shell__toolbar-action` uses `--ngaf-chat-surface-alt` fill.

### Out of scope

- Touching `chat-select` primitive or its styles
- Touching `chat-input` model picker (which already uses chat-select)
- Toolbar wrap/scroll behavior — `overflow-x: auto` stays
- Adding or removing fields in the toolbar
- Mobile breakpoint (`@media max-width: 767px`) layout — stays as is

## Visual treatment

### `.demo-shell__toolbar`

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

### `.demo-shell__segmented-button` and `.demo-shell__field` text

```css
.demo-shell__segmented-button {
  border: 0;
  background: transparent;
  border-radius: 6px;
  min-height: 28px;
  padding: 0 10px;
  cursor: pointer;
  font: inherit;
  color: var(--ngaf-chat-text);
}
.demo-shell__segmented-button.is-active {
  background: var(--ngaf-chat-text);
  color: var(--ngaf-chat-bg);
}
.demo-shell__field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ngaf-chat-text-muted);
  flex: 0 0 auto;
}
```

(`.demo-shell__field select { ... }` block deleted entirely.)

### `.demo-shell__toolbar-action`

```css
.demo-shell__toolbar-action {
  border: 0;
  background: var(--ngaf-chat-surface-alt);
  color: var(--ngaf-chat-text);
  border-radius: 8px;
  padding: 8px 12px;
  min-height: 32px;
  cursor: pointer;
  font: inherit;
  flex: 0 0 auto;
}
.demo-shell__toolbar-action:hover {
  background: color-mix(in srgb, var(--ngaf-chat-text) 8%, var(--ngaf-chat-surface-alt));
}
.demo-shell__segmented-button:hover:not(.is-active) {
  background: color-mix(in srgb, var(--ngaf-chat-text) 8%, transparent);
}
```

## Testing

### Unit
- Demo-shell spec: drive the four chat-select dropdowns (click trigger → click option → assert `onModelChange` / `onEffortChange` / `onGenUiModeChange` / `onThemeChange` called with the option's value). Replace any native-select-driving assertions.
- Demo-shell spec: CSS-string assertion that `.demo-shell__toolbar-action` rule contains `background: var(--ngaf-chat-surface-alt)` and `border-radius: 8px`.

### Manual smoke (chrome MCP)
- Toolbar: font-family ui-sans-serif, font-size 14px on buttons and field labels
- All four dropdowns render as `chat-select` pills, computed `min-width` 180px on the menu (the primitive's default — fine for the toolbar; only welcome-suggestions overrides this)
- "New conversation" reads as a solid surface-alt pill, 8px radius, hover lift
- Mode segmented control unchanged from the user's perspective

## References

- Sub-project A: `docs/superpowers/specs/2026-05-17-sidenav-polish-design.md` (sidenav layout / icon rail)
- Sub-project C: `docs/superpowers/specs/2026-05-17-sidenav-button-treatment-design.md` (monochrome button system this toolbar joins)
- chat-select API: `libs/chat/src/lib/primitives/chat-select/chat-select.component.ts`
- chat-select styles: `libs/chat/src/lib/styles/chat-select.styles.ts`
- Toolbar current source: `examples/chat/angular/src/app/shell/demo-shell.component.{html,css}`
