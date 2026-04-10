# Shared Example Layouts Library

## Problem

The 30 cockpit Angular example apps each define their own layout inline. The 6 render apps have good mobile responsiveness (`flex-col md:flex-row` split panes) but duplicate the pattern across files. The remaining 24 apps (langgraph, deep-agents, chat) use fixed-width sidebars (`w-56` to `w-80`) with no responsive breakpoints, making them unusable on mobile — sidebars consume 60-85% of a 375px screen.

## Solution

A new Nx Angular library `@cacheplane/example-layouts` with two standalone layout components that own responsive behavior. All 30 example apps migrate to use them, gaining consistent mobile support.

## Library: `libs/example-layouts/`

**Package:** `@cacheplane/example-layouts`

### ExampleChatLayoutComponent

Selector: `example-chat-layout`

For apps with a main content area and optional sidebar (21 non-render apps + the 3 no-sidebar apps).

**Template:**

```html
:host {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
}

<div class="flex flex-col md:flex-row flex-1 min-h-0" [class.md:flex-row-reverse]="sidebarPosition() === 'left'">
  <div class="flex-1 min-w-0 min-h-0 flex flex-col">
    <ng-content select="[main]" />
  </div>
  <aside [class]="sidebarClasses()">
    <ng-content select="[sidebar]" />
  </aside>
</div>
```

**Inputs:**
- `sidebarPosition: 'left' | 'right'` — default `'right'`
- `sidebarWidth: string` — default `'w-72'`; the Tailwind width class applied at `md:` breakpoint only

**Responsive behavior:**
- Mobile (< 768px): sidebar is `w-full`, stacks below main content, separated by `border-t border-gray-800`
- Desktop (>= 768px): sidebar gets the configured width class + `shrink-0`, separated by `border-l` or `border-r` depending on position
- Main content area is always `flex-1 min-w-0 min-h-0 flex flex-col`

**Sidebar classes (computed from inputs):**

Desktop right sidebar (default):
```
w-full md:{sidebarWidth} shrink-0 border-t md:border-t-0 md:border-l border-gray-800 overflow-y-auto
```

Desktop left sidebar:
```
w-full md:{sidebarWidth} shrink-0 border-t md:border-t-0 md:border-r border-gray-800 overflow-y-auto
```

**No-sidebar usage:** Apps like `streaming`, `deployment-runtime`, `generative-ui`, and `debug` simply omit the `[sidebar]` element. The `<aside>` is always rendered but has `:empty` CSS that hides it (`aside:empty { display: none }`), so it collapses when no content is projected.

### ExampleSplitLayoutComponent

Selector: `example-split-layout`

For the 6 render apps with the three-zone layout (header → split panes → footer).

**Template:**

```html
:host {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: rgb(3 7 18); /* bg-gray-950 */
  color: rgb(243 244 246); /* text-gray-100 */
}

<div class="shrink-0 border-b border-gray-800">
  <ng-content select="[header]" />
</div>

<div class="flex flex-col md:flex-row flex-1 min-h-0">
  <div class="flex-1 overflow-y-auto p-4 md:p-6 min-h-[200px] md:min-h-0">
    <ng-content select="[primary]" />
  </div>
  <div class="w-full md:w-80 shrink-0 flex flex-col border-t md:border-t-0 md:border-l border-gray-800 bg-gray-900/50">
    <ng-content select="[secondary]" />
  </div>
</div>

<div class="shrink-0">
  <ng-content select="[footer]" />
</div>
```

**No inputs.** All render apps use the same structure. The four content projection slots:
- `[header]` — spec picker bar
- `[primary]` — live render output (left pane)
- `[secondary]` — streaming JSON + controls (right pane)
- `[footer]` — timeline scrubber bar

## Migration by App

### Apps using ExampleChatLayoutComponent

| App | Sidebar | Width | Position | Notes |
|-----|---------|-------|----------|-------|
| langgraph/streaming | None | — | — | No sidebar, just `[main]` |
| langgraph/deployment-runtime | None | — | — | No sidebar |
| langgraph/persistence | Right | `w-56` | right | Remove `:host` styles |
| langgraph/interrupts | None | — | — | Interrupt panel inside `[main]` |
| langgraph/memory | Right | `w-72` | right | |
| langgraph/subgraphs | Right | `w-72` | right | |
| langgraph/time-travel | Right | `w-72` | right | |
| langgraph/durable-execution | Right | `w-64` | right | |
| deep-agents/planning | Right | `w-72` | right | |
| deep-agents/filesystem | Right | `w-72` | right | |
| deep-agents/subagents | Right | `w-72` | right | |
| deep-agents/memory | Right | `w-72` | right | |
| deep-agents/skills | Right | `w-72` | right | |
| deep-agents/sandboxes | Right | `w-80` | right | |
| chat/messages | Right | `w-72` | right | Main uses manual primitives, not `<chat>` |
| chat/threads | Left | `w-64` | left | Only left-sidebar app |
| chat/input | Right | `w-72` | right | Main uses manual primitives |
| chat/interrupts | Right | `w-80` | right | |
| chat/tool-calls | Right | `w-80` | right | |
| chat/subagents | Right | `w-80` | right | |
| chat/timeline | Right | `w-80` | right | |
| chat/debug | None | — | — | No sidebar |
| chat/theming | Right | `w-72` | right | |
| chat/generative-ui | None | — | — | No sidebar |

### Apps using ExampleSplitLayoutComponent

All 6 render apps:
- render/spec-rendering
- render/element-rendering
- render/state-management
- render/registry
- render/repeat-loops
- render/computed-functions

## Migration Pattern

### Chat layout — before:

```html
<div class="flex h-screen">
  <chat [ref]="stream" class="flex-1 min-w-0" />
  <aside class="w-72 shrink-0 border-l border-gray-800 overflow-y-auto p-4 space-y-2"
         style="...">
    ...sidebar content...
  </aside>
</div>
```

### Chat layout — after:

```html
<example-chat-layout sidebarWidth="w-72">
  <chat main [ref]="stream" />
  <div sidebar class="p-4 space-y-2" style="...">
    ...sidebar content...
  </div>
</example-chat-layout>
```

The app removes: wrapper `div.flex.h-screen`, fixed sidebar width, `shrink-0`, border classes, `overflow-y-auto` on sidebar (layout component handles it).

The app keeps: sidebar inner content, padding, spacing, styling, all component bindings.

### Split layout — before:

```html
<div class="flex flex-col h-full bg-gray-950 text-gray-100">
  <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
    ...spec picker buttons...
  </div>
  <div class="flex flex-col md:flex-row flex-1 min-h-0">
    <div class="flex-1 overflow-y-auto p-4 md:p-6 min-h-[200px] md:min-h-0">
      ...render output...
    </div>
    <div class="w-full md:w-80 shrink-0 flex flex-col border-t md:border-t-0 md:border-l border-gray-800 bg-gray-900/50">
      ...json pane + controls...
    </div>
  </div>
  <streaming-timeline [simulator]="simulator" class="border-t border-gray-800" />
</div>
```

### Split layout — after:

```html
<example-split-layout>
  <div header class="flex items-center gap-2 px-4 py-3">
    ...spec picker buttons...
  </div>
  <div primary>
    ...render output...
  </div>
  <div secondary>
    ...json pane + controls...
  </div>
  <streaming-timeline footer [simulator]="simulator" class="border-t border-gray-800" />
</example-split-layout>
```

### Special cases

**langgraph/persistence:** Remove `:host { display: flex; height: 100vh }` from component styles. Use `<example-chat-layout>` like all other sidebar apps.

**langgraph/interrupts:** No sidebar. The interrupt panel lives inside `[main]` as part of the vertical stack:

```html
<example-chat-layout>
  <div main class="flex flex-col h-full">
    <chat [ref]="stream" class="flex-1 min-w-0" />
    @if (stream.interrupt()) {
      <div class="p-4 border-t border-gray-800">
        <chat-interrupt-panel ... />
      </div>
    }
  </div>
</example-chat-layout>
```

**chat/messages and chat/input:** These assemble primitives manually instead of using `<chat>`. Their main content is a custom `flex-col` column — this goes into the `[main]` slot unchanged.

## Testing

### Unit tests for layout components

- `ExampleChatLayoutComponent`: renders `[main]` and `[sidebar]` content, applies correct responsive classes, `sidebarPosition` input flips order, `sidebarWidth` input applied, no sidebar renders cleanly when `[sidebar]` omitted
- `ExampleSplitLayoutComponent`: renders all four slots, correct responsive classes on split panes

### Build verification

All 30 Angular apps must build successfully: `npx nx run-many -t build --projects='cockpit-*-angular'`

### Mobile verification

Chrome DevTools device toolbar at 375px width on representative apps:
- A sidebar app (e.g. `langgraph/memory`) — sidebar should stack below chat
- A left-sidebar app (`chat/threads`) — sidebar should stack below
- A render app (e.g. `render/spec-rendering`) — panes should stack vertically
- A no-sidebar app (e.g. `langgraph/streaming`) — should fill viewport normally

## File Changes

| Action | Path |
|--------|------|
| Create | `libs/example-layouts/src/lib/example-chat-layout.component.ts` |
| Create | `libs/example-layouts/src/lib/example-chat-layout.component.spec.ts` |
| Create | `libs/example-layouts/src/lib/example-split-layout.component.ts` |
| Create | `libs/example-layouts/src/lib/example-split-layout.component.spec.ts` |
| Create | `libs/example-layouts/src/index.ts` |
| Create | `libs/example-layouts/project.json` |
| Create | `libs/example-layouts/tsconfig.json` / `tsconfig.lib.json` / `tsconfig.spec.json` |
| Modify | `tsconfig.base.json` — add `@cacheplane/example-layouts` path mapping |
| Modify | 6 render app components — migrate to `ExampleSplitLayoutComponent` |
| Modify | 24 non-render app components — migrate to `ExampleChatLayoutComponent` |
