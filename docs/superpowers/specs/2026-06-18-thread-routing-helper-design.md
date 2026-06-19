# Consistent Thread Persistence — `injectThreadRouting` Design

**Status:** Approved (brainstorm) — ready for implementation plan
**Date:** 2026-06-18
**Scope:** `@threadplane/chat` (new neutral helper) + adoption in the LangGraph-backed thread demos; an AG-UI spike.

## Problem

Thread persistence is reinvented per app. `examples/chat` has a robust ~100-line URL-as-source-of-truth implementation hand-rolled in its shell; every other thread-aware app either reinvents it in-memory (lost on reload) or uses an ad-hoc pattern.

Audit matrix:

| App | Survives reload / shareable | Mechanism | List source |
|-----|------|-----------|-------------|
| `examples/chat` ⭐ | yes | URL-as-source-of-truth (hand-rolled, ~100 lines) + validation | `LangGraphThreadsAdapter` |
| `examples/ag-ui` | no (ephemeral) | knobs in query-params only; no `threadId` | none |
| `cockpit/chat/threads` | no | in-memory signal | `LangGraphThreadsAdapter` |
| `cockpit/langgraph/persistence` | no | in-memory signal + ad-hoc `onThreadId` list tracking | derived manually |
| `cockpit/chat/messages`, `cockpit/langgraph/memory` | n/a | single-session feature demos | — |

The library already ships the thread *list/CRUD* toolkit (`LangGraphThreadsAdapter`, `ChatSidenavComponent`, `Thread`, `ThreadActionAdapter`, `getThread`). The missing, duplicated piece is the **URL ↔ active-threadId binding + restore-on-reload**. Neither of the two reference frameworks studied ships URL routing — they leave it to the app and keep the active thread id as a single owned signal with the server authoritative for messages. So providing a thin, adapter-neutral routing helper is a genuine value-add, not a re-implementation.

## Goals

1. One reusable helper that binds a URL segment ↔ an app-owned `activeThreadId` signal, with restore-on-reload, signal→URL stamping, optional validation, and the "bare URL = welcome / no thread" convention.
2. Adapter-neutral (works for any adapter whose `provideAgent` accepts a `threadId` signal + `onThreadId` callback — both LangGraph and AG-UI do).
3. Refactor `examples/chat` onto it (behavior-identical) and adopt it in the lagging LangGraph thread demos so they survive reload and are shareable.
4. Make URL-as-source-of-truth the documented canonical pattern.

Non-goals (YAGNI): a thread *list* abstraction (the adapter already provides it); localStorage persistence of the active thread (rejected — breaks shareability, per the existing `2026-05-20-url-thread-routing-design.md`); auto-creating a thread on load (the agent stamps the id on first message — implicit→explicit).

## Architecture

The helper is the URL-binding logic only. The app **owns** the `activeThreadId` signal (module- or token-scope, because `provideAgent` runs at provider-decoration time and must reference it before the component instance exists — the same constraint `examples/chat` already lives with). The helper, called in the shell's injection context, wires that signal to the Angular `Router`.

### Component — `injectThreadRouting(config)` (`libs/chat/src/lib/routing/thread-routing.ts`, new)

```ts
export interface ThreadRoutingConfig {
  /** The app-owned source-of-truth signal for the active thread id. */
  threadId: WritableSignal<string | null>;
  /** Build the router commands for a thread id (or the bare/welcome path when null).
   *  Default: `(id) => (id ? ['/', id] : ['/'])`. */
  toCommands?: (id: string | null) => unknown[];
  /** Extract the thread id from a URL (null = bare/welcome). Default: last non-empty
   *  path segment. */
  threadIdFromUrl?: (url: string) => string | null;
  /** Optional async validity check. When it resolves false, the helper redirects to the
   *  bare path (`replaceUrl: true`). LangGraph apps pass `id => threads.getThread(id).then(Boolean)`. */
  validate?: (id: string) => Promise<boolean>;
  /** Router navigation extras merged into every navigate (default `{ queryParamsHandling: 'preserve' }`). */
  navigationExtras?: NavigationExtras;
}

/** Bind an app-owned `activeThreadId` signal to the URL: restore on load, stamp on change,
 *  validate-or-redirect. Must be called in an Angular injection context (sets up effects). */
export function injectThreadRouting(config: ThreadRoutingConfig): void;
```

Internals (extracted from `examples/chat` `demo-shell.component.ts`, generalized):
- **URL → signal** effect: tracks the router URL (via `toSignal` of `NavigationEnd`), parses `threadIdFromUrl`, and if it differs from `untracked(threadId)` sets the signal. Untracked read prevents the imperative-write loop.
- **signal → URL** effect: when `threadId()` changes (agent `onThreadId` stamp, or sidenav switch), `router.navigate(toCommands(id), navigationExtras)`.
- **Validation** effect (only if `validate` provided): on a non-null URL thread id, `await validate(id)`; if false, navigate to `toCommands(null)` with `replaceUrl: true` (handles 404/422 stale links).
- Bare URL (`threadIdFromUrl` → null) leaves `threadId` null = welcome; never creates a thread.

Defaults make the simplest case (`/:threadId`) zero-config; `examples/chat`'s mode-prefixed paths (`/embed/<id>`) are expressed via `toCommands`/`threadIdFromUrl`.

### App wiring pattern (documented, ~3 lines beyond providers)

```ts
export const ACTIVE_THREAD = signal<string | null>(null);          // app-owned source of truth

// app.config / component providers:
provideAgent({ assistantId, threadId: ACTIVE_THREAD, onThreadId: (id) => ACTIVE_THREAD.set(id) });

// shell component (injection context):
const threads = inject(LangGraphThreadsAdapter);
injectThreadRouting({ threadId: ACTIVE_THREAD, validate: (id) => threads.getThread(id).then(Boolean) });
```

## Adoption

- **`examples/chat`** — refactor the shell onto `injectThreadRouting` using `toCommands`/`threadIdFromUrl` for the mode-prefixed paths; delete the hand-rolled effects + `parseUrl`. Behavior identical (proven by the existing thread-routing e2e). This is the reference adoption.
- **`cockpit/chat/threads`** — replace the in-memory `activeThreadIdState` wiring with the helper (gains reload-survival + shareable URLs). Add a route param if the app currently has none.
- **`cockpit/langgraph/persistence`** — adopt the helper AND switch from ad-hoc `onThreadId` list tracking to `LangGraphThreadsAdapter.threads()`, so it stops modeling a divergent list pattern.
- **Feature-focused demos** (`cockpit/chat/messages`, `cockpit/langgraph/memory`) — unchanged (single-session is correct).
- **`examples/ag-ui` (spike)** — first verify the itinerary AG-UI server restores a conversation when `HttpAgent` is constructed with a prior `threadId` (check `examples/ag-ui/python` + the AG-UI protocol/thread handling). If it does: wire `examples/ag-ui` onto the same helper (`provideAgent({ url, threadId, ... })` + `injectThreadRouting`). If it does not: leave it ephemeral and add a one-paragraph note in the app/docs stating the server doesn't persist by thread, so the choice is intentional.

## Docs

A short guide (`apps/website/content/docs/.../thread-routing.mdx` or the chat guides section) documenting URL-as-source-of-truth + `injectThreadRouting`, superseding the demo-only pattern. Reference the `2026-05-20-url-thread-routing-design.md` doctrine (no localStorage for the active thread; bare = welcome; validate stale links).

## Error handling & edge cases

- **Stale/deleted thread in URL:** `validate` false → redirect to bare with `replaceUrl: true` (no history entry for the dead link).
- **Agent auto-creates a thread (first message):** `onThreadId` sets the signal → signal→URL effect stamps `/<id>` (or `/<mode>/<id>`). The async gap between submit and the id arriving is handled by the untracked read (no loop), exactly as today.
- **Back/forward navigation:** URL→signal effect re-syncs; agent reconnects to the URL's thread.
- **No `validate` provided:** the helper trusts the URL id (fine for adapters without a getThread; the agent connect will surface a backend error via the now-structured `AgentError`).
- **Bare path on load:** welcome state, `threadId` stays null, no thread created.

## Testing strategy

- **Unit (`thread-routing.spec.ts`):** with a `RouterTestingHarness`/mock Router — URL→signal restore on init; signal→URL navigate on change; `validate` false → redirect to bare (`replaceUrl`); bare URL → null signal (no navigate, no create); custom `toCommands`/`threadIdFromUrl` (mode-prefixed) round-trips.
- **`examples/chat` e2e:** the existing thread-routing e2e must stay green through the refactor (load thread route, switch updates URL, back/forward, agent-allocated id survives the nav gap).
- **One cockpit thread-restore e2e:** for `cockpit/chat/threads` (or persistence) — create/switch a thread, reload, assert the conversation is restored from the URL.
- Existing chat unit suite + the adopting apps build green; build the adopting apps.

## Files touched

- `libs/chat/src/lib/routing/thread-routing.ts` *(new)* — `injectThreadRouting`, `ThreadRoutingConfig`.
- `libs/chat/src/lib/routing/thread-routing.spec.ts` *(new)*.
- `libs/chat/src/public-api.ts` — export `injectThreadRouting`, `ThreadRoutingConfig`.
- `examples/chat/angular/src/app/shell/demo-shell.component.ts` — refactor onto the helper (net deletion).
- `cockpit/chat/threads/angular/src/app/*` + `cockpit/langgraph/persistence/angular/src/app/*` — adopt helper; persistence app switches to the threads adapter list; add route param(s) where missing.
- `examples/ag-ui/angular/*` — conditional (spike outcome).
- Docs: a thread-routing guide.

## Risks

- **`examples/chat` refactor regressing the URL doctrine.** Mitigated by keeping behavior identical and gating on the existing thread-routing e2e; the helper is a straight extraction.
- **Per-app route shapes differ** (mode-prefixed vs plain). Mitigated by the `toCommands`/`threadIdFromUrl` config; defaults cover the plain case.
- **AG-UI spike may be negative** (server doesn't restore by thread) — acceptable; the verify-then-decide scope makes that an explicit, documented outcome rather than dead UI.
