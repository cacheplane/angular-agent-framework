# URL-based thread routing — design

## Goal

Make the active LangGraph thread part of the URL so links to specific
conversations on the canonical demo are shareable and survive reload.

## URL is the source of truth

The URL is the **sole** source of truth for the active thread. The
shell does not persist the active thread to localStorage:

- `/embed`, `/popup`, `/sidebar` — bare mode paths mean "no active
  thread" (welcome state).
- `/embed/<id>`, `/popup/<id>`, `/sidebar/<id>` — that thread, in that
  presentation mode.

Sharing `/embed/abc` lands on thread `abc`. Sharing `/embed` always
lands on the welcome state, regardless of what the recipient's browser
last used. There is no localStorage fallback to "last active thread"
— that conflates user intent with browser-local state and breaks
shareability.

## Route shape

Each mode gets a single route entry via `UrlMatcher` that accepts both
`<mode>` and `<mode>/<threadId>` shapes under one entry. This is
critical: a per-shape pair (two entries) causes Angular to destroy and
remount the mode component when navigating `/embed` → `/embed/<id>`,
which kills any in-flight agent stream (see PR #500/#504 history).

```ts
function modeMatcher(modeName: string): UrlMatcher {
  return (segments) => {
    if (segments.length === 0 || segments[0].path !== modeName) return null;
    if (segments.length === 1) return { consumed: segments, posParams: {} };
    if (segments.length === 2) {
      return { consumed: segments, posParams: { threadId: segments[1] } };
    }
    return null;
  };
}

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'embed' },
  {
    path: '',
    loadComponent: () => import('./shell/demo-shell.component').then((m) => m.DemoShell),
    children: [
      { matcher: modeMatcher('embed'),   loadComponent: () => import('./modes/embed-mode.component').then((m) => m.EmbedMode) },
      { matcher: modeMatcher('popup'),   loadComponent: () => import('./modes/popup-mode.component').then((m) => m.PopupMode) },
      { matcher: modeMatcher('sidebar'), loadComponent: () => import('./modes/sidebar-mode.component').then((m) => m.SidebarMode) },
    ],
  },
  { path: '**', redirectTo: 'embed' },
];
```

DemoShell parses the URL itself (via `router.url` + a NavigationEnd
`toSignal`) rather than reading param maps from `route.firstChild`,
because the param data lives on the matched route under `posParams`
and is more reliably read this way.

## URL ↔ signal sync (in DemoShell)

Two reactive flows in DemoShell, with guards against render loops:

1. **URL → signal.** A `toSignal(NavigationEnd)` pipes the current URL
   through `parseUrl()` to extract `{mode, threadId}`. An `effect`
   reads the URL's `threadId` and writes it into `threadIdSignal` iff
   it differs from the current value. The signal read is `untracked`
   so the effect only fires on URL changes, not on imperative signal
   writes (critical for the stamp-in-progress async gap — see below).

2. **signal → URL.** A second `effect` reads `threadIdSignal` + the
   current `mode()` and `router.navigate(['/', mode, id])` if the URL
   doesn't already match. Uses default `replaceUrl: false` so the
   back button walks through visited threads.

The compare-and-set guard in flow 1 prevents the obvious
URL→signal→URL loop: by the time the signal→URL effect fires, the
values match and `router.navigate` is skipped.

### Stamp-in-progress invariant

When the agent auto-creates a thread mid-send, the `onThreadId`
callback fires immediately and sets `threadIdSignal`. The signal→URL
effect then navigates asynchronously. During the gap, the URL is
still bare. The URL→signal effect MUST NOT clear the just-set signal
back to `null` during this window — that would lose the agent's
allocation. This is enforced by:

- The URL→signal effect tracks only `urlThreadId()`, not the signal.
  Imperative signal writes don't refire it.
- The signal read inside the effect is `untracked`.

There is no test covering the no-nav-loop invariant directly; the
"does not clear an agent-created thread id while URL navigation is
still pending" test (`demo-shell.component.spec.ts`) covers the
stamp-in-progress case.

## Invalid id handling

When a route loads with a `:threadId` the user has never seen (typo,
deleted thread, link from another browser), silently redirect to the
bare mode path:

```ts
const thread = await threadsSvc.getThread(id);
if (!thread) router.navigate(['/', mode()], { replaceUrl: true });
```

`replaceUrl: true` so the back button doesn't reload the broken URL.

Validation runs as a separate `effect` from the URL→signal sync, with
a `lastValidated` closure variable to dedupe — `getThread` is async
and we don't want to re-hit the server on every signal flip that
round-trips the same id.

Requires `LangGraphThreadsAdapter.getThread()`:

```ts
async getThread(threadId: string): Promise<Thread | null>
```

Wraps `client.threads.get(id)`. Returns `null` on 404 and 422 (the
latter for malformed UUIDs); rethrows on other failures so genuine
network errors don't get masked as "thread missing."

## Mode switching preserves thread

`/embed/abc` → click "Popup" tab → `/popup/abc`. The `onModeChange`
handler navigates with the current id:

```ts
protected onModeChange(next: DemoMode | string): void {
  const id = this.threadIdSignal();
  void this.router.navigate(id ? ['/', next, id] : ['/', next]);
}
```

This is the **only** mechanism that preserves the active thread
across mode boundaries. There is no localStorage backstop — direct
URL navigation to `/popup` (e.g. paste link, back button) clears the
active thread.

## Out of scope

- Server-side render of `<title>`/og:* tags for richer link previews
- Restoring scroll position to the last-read message on reload
- Authentication / private threads — these URLs are already public on
  the demo and that's fine
- Round-tripping agent knobs (model, effort, theme, ...) via query
  params — see follow-up #494

## Test plan

- `LangGraphThreadsAdapter.getThread()` — returns `Thread` for an
  existing id, returns `null` for a missing id (404 or 422), rethrows
  on other errors
- Demo route loads `/embed/<existing-id>` → `threadIdSignal()` ===
  that id, messages from that thread render
- Demo route loads `/embed/<bogus-id>` → silently redirects to
  `/embed`, fresh chat
- Bare-mode route loads → `threadIdSignal()` is `null` regardless of
  any legacy localStorage state
- Agent-allocated thread id survives the URL navigation async gap
  (stamp-in-progress invariant)
- Click a thread in the sidenav → URL updates to `/<mode>/<id>`
- Click mode toggle while a thread is active → URL switches mode but
  keeps the id
- Browser back/forward across visited threads — agent state matches
  the URL at each step
