# URL-based thread routing — design

## Goal

Make the active LangGraph thread part of the URL so links to specific
conversations on the canonical demo are shareable and survive reload.

## Current state

`DemoShell.threadIdSignal = signal<string | null>(persistence.read('threadId') ?? null)`.
The agent watches the signal; `onThreadId` callbacks write it back +
persist to localStorage. Routes are `/embed`, `/popup`, `/sidebar` —
all stateless paths; the active thread lives only in localStorage.
Sharing `/embed` always lands on whichever thread that browser last
used (or a fresh one).

## URL shape

```
/<mode>/:threadId?
```

`:threadId` is optional. Angular doesn't support `?` syntax for
optional params, so each mode gets two route entries:

```ts
{ path: 'embed',              component: EmbedMode },
{ path: 'embed/:threadId',    component: EmbedMode },
{ path: 'popup',              component: PopupMode },
{ path: 'popup/:threadId',    component: PopupMode },
{ path: 'sidebar',            component: SidebarMode },
{ path: 'sidebar/:threadId',  component: SidebarMode },
```

## URL ↔ signal sync (in DemoShell)

URL is the source of truth when present; localStorage falls back when
the URL has no id.

Two reactive flows in DemoShell, with guards against render loops:

1. **URL → signal.** `toSignal(route.firstChild.paramMap)` (the active
   mode component owns the param). An `effect` reads the URL's
   `threadId` and writes it into `threadIdSignal` if-and-only-if it
   differs from the current value.
2. **signal → URL.** A second `effect` reads `threadIdSignal` + the
   current `mode()` and `router.navigate(['/', mode, id])` if the URL
   doesn't already match. Uses `replaceUrl: false` so the back button
   walks through visited threads.

The "if it differs" guard is the only thing preventing the obvious
URL→signal→URL→signal loop. Both effects already short-circuit
because Angular signal writes are no-ops when the value is unchanged,
but `router.navigate` doesn't short-circuit, so the explicit URL
comparison in flow #2 is required.

## Invalid id handling

When a route loads with a `:threadId` the user has never seen (typo,
deleted thread, link from another browser), we silently redirect to
the bare mode path:

```ts
const thread = await threadsSvc.getThread(id);
if (!thread) router.navigate(['/', mode()], { replaceUrl: true });
```

`replaceUrl: true` so the back button doesn't reload the broken URL.

This requires a new method on `LangGraphThreadsAdapter`:

```ts
async getThread(threadId: string): Promise<Thread | null>
```

Wraps `client.threads.get(id)`. Returns `null` on 404 (caught from
the SDK's thrown error); rethrows on other failures so genuine
network errors don't get masked as "thread missing."

## Mode switching preserves thread

`/embed/abc` → click "Popup" tab → `/popup/abc`. The `onModeChange`
handler already exists; updates to include the current thread id:

```ts
protected onModeChange(next: DemoMode | string): void {
  const id = this.threadIdSignal();
  void this.router.navigate(id ? ['/', next, id] : ['/', next]);
}
```

## Out of scope

- Server-side render of `<title>`/og:* tags for richer link previews
- Restoring scroll position to the last-read message on reload
- Authentication / private threads — these URLs are already public on
  the demo and that's fine

## Test plan

- `LangGraphThreadsAdapter.getThread()` — returns `Thread` for an
  existing id, returns `null` for a missing id, rethrows on other
  errors
- Demo route loads `/embed/<existing-id>` → `threadIdSignal()` ===
  that id, messages from that thread render
- Demo route loads `/embed/<bogus-id>` → silently redirects to
  `/embed`, fresh chat
- Click a thread in the sidenav → URL updates to `/<mode>/<id>`
- Click mode toggle while a thread is active → URL switches mode but
  keeps the id
- Browser back/forward across visited threads — agent state matches
  the URL at each step
