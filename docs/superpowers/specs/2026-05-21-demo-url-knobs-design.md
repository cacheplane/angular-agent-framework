# Demo URL knob round-trip — Design

**Status:** Approved (scope adapted from closed PR #494)
**Date:** 2026-05-21
**Goal:** Round-trip the canonical demo's agent knobs (model, reasoning effort, gen-UI mode, theme, color scheme, selected project) through the URL alongside the already-shipped thread id path segment. Ephemeral semantics — URL writes signals on visit but never writes to recipient localStorage.

## Why now

URL routing for the thread id landed (PR #500 → #504 → #518). Sharing `/embed/<id>` lands on that thread but defaults for everything else. With knob query params, a visitor who customized model/theme/etc. can share their exact view as a link.

## Relationship to recent PRs

- ✅ PR #500: thread id in URL path + `getThread()` validator
- ✅ PR #504: `UrlMatcher` collapse — preserves mode-component instance across `<mode>` ↔ `<mode>/:threadId`
- ✅ PR #518: localStorage `threadId` persistence removed; URL is sole source of truth for active thread

This spec **builds on top of** those — does not regress any. UrlMatcher stays. `getThread()` stays. URL-as-truth for `threadId` stays.

## Scope

This PR adds:
1. **Knob query param round-trip** (model, effort, genui, theme, color, project)
2. **Ephemeral hydration semantics** — URL writes signals but NOT localStorage
3. **Deep-link e2e spec** — Playwright assertions for `/embed/<id>?model=...` direct loads

## URL shape

```
/<mode>[/<thread-id>][?model=&effort=&genui=&theme=&color=&project=]
```

Examples (additions vs current behavior in bold):
- `/embed` — fresh demo, all defaults
- `/embed/019e434c-...` — that thread, defaults
- **`/embed/019e434c-...?model=gpt-5-nano&effort=high`** — thread + non-default knobs
- **`/popup/abc?theme=material-dark&color=light`** — full state, popup mode
- **`/sidebar?theme=material-dark`** — no thread yet, custom theme

**Default values are omitted from URL.** Shared URLs stay short for unchanged knobs. The defaults table:

| Param | Default | Signal in DemoShell |
|---|---|---|
| `model` | `gpt-5-mini` | `model` |
| `effort` | `minimal` | `effort` |
| `genui` | `a2ui` | `genUiMode` |
| `theme` | `default-dark` | `theme` |
| `color` | `dark` | `colorScheme` |
| `project` | `null` (omitted) | `selectedProjectId` |

## Architecture

### Routes — no change required

The `UrlMatcher` factory shipped in #504 (`app.routes.ts`) already consumes `<mode>` and `<mode>/<threadId>` under a single entry per mode. Query params are orthogonal to path matching — Angular reads them via `ActivatedRoute.queryParamMap` regardless of route shape. **No changes to `app.routes.ts`.**

### URL → signal hydration (new bridge in DemoShell)

A new private method `hydrateFromQuery()` runs once on `DemoShell` construction and again on every `NavigationEnd`:

```ts
private hydrateFromQuery(): void {
  const params = new URL(this.router.url, 'http://x').searchParams;

  const knobs = [
    ['model', this.model],
    ['effort', this.effort],
    ['genui', this.genUiMode],
    ['theme', this.theme],
    ['color', this.colorScheme],
    ['project', this.selectedProjectId],
  ] as const;

  for (const [key, signal] of knobs) {
    const urlValue = params.get(key);
    if (urlValue !== null && urlValue !== signal()) {
      // Ephemeral: set the signal, do NOT call persistence.write().
      (signal as { set(v: string): void }).set(urlValue);
    }
  }
}
```

Wired via the existing NavigationEnd subscription that drives `urlState`:

```ts
// In constructor, alongside the URL→threadId sync effect:
effect(() => {
  void this.urlState();  // trigger on NavigationEnd
  untracked(() => this.hydrateFromQuery());
});
```

**Why use `URL(router.url).searchParams` and not `ActivatedRoute.queryParamMap`?** ActivatedRoute requires injection plumbing across the route tree; we already parse `router.url` for the mode/threadId via `parseUrl()`. Same approach for query params keeps the bridge in one place.

### Signal → URL writes (new navigation calls in knob handlers)

Each knob handler gains a `writeKnobsToUrl()` call after the existing `persistence.write(...)`:

```ts
protected onModelChange(next: string): void {
  this.model.set(next);
  this.persistence.write('model', next);
  this.writeKnobsToUrl();
}
```

`writeKnobsToUrl()` builds the full query-params object (every knob mapped to either its non-default value or `null`) and calls:

```ts
private writeKnobsToUrl(): void {
  const queryParams = this.buildQueryParams();
  void this.router.navigate([], {
    relativeTo: this.activatedRoute,
    queryParams,
    queryParamsHandling: 'merge',
    replaceUrl: true,
  });
}

private buildQueryParams(): Record<string, string | null> {
  return {
    model:   this.model()           === 'gpt-5-mini'     ? null : this.model(),
    effort:  this.effort()          === 'minimal'        ? null : this.effort(),
    genui:   this.genUiMode()       === 'a2ui'           ? null : this.genUiMode(),
    theme:   this.theme()           === 'default-dark'   ? null : this.theme(),
    color:   this.colorScheme()     === 'dark'           ? null : this.colorScheme(),
    project: this.selectedProjectId() ?? null,
  };
}
```

`queryParamsHandling: 'merge'` + nulls drop default keys from the URL automatically. `replaceUrl: true` so dropdown clicks don't pollute browser history.

### Mode-switch preserves query params

The existing `onModeChange` (line 418-423) only navigates path segments. Update to also pass query params:

```ts
protected onModeChange(next: DemoMode | string): void {
  const id = this.threadIdSignal();
  void this.router.navigate(id ? ['/', next, id] : ['/', next], {
    queryParamsHandling: 'preserve',  // ← new
  });
}
```

### Thread switch (already-existing signal→URL effect) — no change

The current signal→URL effect (line 153-159) calls `router.navigate(['/', mode, sigId])` without `queryParamsHandling`, which DROPS query params on thread switch. Update to preserve:

```ts
effect(() => {
  const sigId = this.threadIdSignal();
  const { mode, threadId: urlId } = this.urlState();
  if (sigId === urlId) return;
  const cmds: unknown[] = sigId ? ['/', mode, sigId] : ['/', mode];
  void this.router.navigate(cmds as string[], { queryParamsHandling: 'preserve' });
});
```

## Files touched

| File | Change |
|---|---|
| `examples/chat/angular/src/app/shell/demo-shell.component.ts` | `hydrateFromQuery()` + `writeKnobsToUrl()` + `buildQueryParams()`; 6 knob handlers gain a `writeKnobsToUrl()` call; `onModeChange` + the signal→URL effect gain `queryParamsHandling: 'preserve'`. |
| `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts` | New tests (see below). |
| `examples/chat/angular/e2e/url-routing.spec.ts` | NEW file: deep-link e2e. |

No library changes. No app.routes.ts changes. No palette-persistence.service.ts changes.

## Testing

### Unit tests (in `demo-shell.component.spec.ts`)

1. **Knob hydration from query params** — navigate to `/embed?model=gpt-5-nano&effort=high` → assert `model() === 'gpt-5-nano'` and `effort() === 'high'`.
2. **Ephemeral hydration** — navigate to `/embed?theme=material-dark`; assert localStorage was NOT written (read back the palette JSON, confirm `theme` is absent or unchanged).
3. **Default values omitted from URL** — call `onModelChange('gpt-5-mini')` (the default) → assert URL has no `model=` param.
4. **Non-default values appear in URL** — call `onModelChange('gpt-5-nano')` → assert URL contains `?model=gpt-5-nano`.
5. **Mode change preserves query params** — at `/embed/abc?model=gpt-5-nano`, call `onModeChange('popup')` → URL becomes `/popup/abc?model=gpt-5-nano`.
6. **Thread switch preserves query params** — at `/embed?model=gpt-5-nano`, set `threadIdSignal` to `'xyz'` → URL becomes `/embed/xyz?model=gpt-5-nano` (signal→URL effect path).
7. **User knob action persists** — call `onThemeChange('material-dark')` → assert `persistence.write('theme', 'material-dark')` was called (existing behavior, regression guard).

### E2e tests (new file `url-routing.spec.ts`)

1. **Deep link with thread id** — `page.goto('/embed/<seeded-thread-id>')` → wait for the thread's existing assistant message to render.
2. **Deep link with knob** — `page.goto('/embed?model=gpt-5-nano')` → assert the model picker reads "gpt-5-nano".
3. **Mode switch preserves both thread + knobs** — From `/embed/<id>?model=gpt-5-nano`, click the Popup mode button → URL is `/popup/<id>?model=gpt-5-nano`.
4. **Ephemeral hydration** — Open `/embed?theme=material-dark` in fresh context → close → reopen `/embed` (no query) → theme is back to default (NOT material-dark from a stale localStorage write).

## Out of scope

- A visible "Copy link" UI button — the URL is the link, copy from address bar.
- OG tags / SSR for social previews.
- Auth or read-only modes for shared threads.
- URL state for sub-controls inside chat-input.
- Cross-tab synchronization.
- A migration path that reads old `localStorage.threadId` on first load — already not relevant post-#518.
- New persistence keys; the `PalettePersistence` shape is unchanged.

## Risks

- **Navigation loops**: knob → URL writes call `router.navigate` which fires NavigationEnd which triggers `hydrateFromQuery()` which sets signals. Mitigation: the URL→signal write has a compare-and-set guard (`urlValue !== signal()`), so identical values are no-op. The signal→URL effect uses `replaceUrl: true` so even if a loop existed it wouldn't pollute history.
- **Stamp-in-progress for knobs**: agent-allocated thread id has a stamp-in-progress window; knobs don't have an equivalent because there's no async callback that writes them. Not a concern.
- **`queryParamsHandling: 'merge'` vs. removing knob from URL**: setting a knob to `null` in the params object correctly drops it from the URL when using `merge`. Verified in tests #3 and #5.

## References

- Current `demo-shell.component.ts:125-159` — URL↔threadId sync block; knob bridge slots in alongside.
- Current `palette-persistence.service.ts:6-16` — `PaletteState` shape (unchanged).
- Current `app.routes.ts:18-30` — UrlMatcher factory (unchanged).
- Closed PR #494 — original broader scope; this spec subsets it to the still-needed bits.
