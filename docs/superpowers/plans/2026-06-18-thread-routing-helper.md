# Thread-Routing Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`).

**Goal:** Extract `examples/chat`'s hand-rolled URL↔threadId sync into a reusable, adapter-neutral `injectThreadRouting()` in `@threadplane/chat`, then adopt it in the LangGraph thread demos so they survive reload + are shareable.

**Architecture:** The app owns the `activeThreadId` signal (so `provideAgent` can reference it); `injectThreadRouting(config)`, called in the shell's injection context, binds that signal to the Angular Router (restore-on-load, signal→URL stamp, validate-or-redirect, bare=welcome).

**Tech Stack:** Angular 21 (signals, `toSignal`, `effect`, Router), vitest, Nx. No backcompat constraint.

**Reference spec:** `docs/superpowers/specs/2026-06-18-thread-routing-helper-design.md`.

---

## Task 1: `injectThreadRouting` helper (TDD)

**Files:**
- Create: `libs/chat/src/lib/routing/thread-routing.ts`
- Create: `libs/chat/src/lib/routing/thread-routing.spec.ts`
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Write the failing test** — `thread-routing.spec.ts`. Use Angular's Router testing. Cover: URL→signal restore on init; signal→URL navigate on change; `validate` false → redirect to bare with `replaceUrl`; bare URL → null signal (no navigate); custom `toCommands`/`threadIdFromUrl` round-trip.
```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { injectThreadRouting } from './thread-routing';

@Component({ template: '' })
class Blank {}

function setup(threadId: WritableSignal<string | null>, cfg: Partial<Parameters<typeof injectThreadRouting>[0]> = {}) {
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: '**', component: Blank }])],
  });
  const router = TestBed.inject(Router);
  return { router };
}

describe('injectThreadRouting', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('restores the signal from the URL on init', async () => {
    const threadId = signal<string | null>(null);
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] } as never])] });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/abc123');
    TestBed.runInInjectionContext(() => injectThreadRouting({ threadId }));
    TestBed.tick?.();
    expect(threadId()).toBe('abc123');
  });

  it('navigates to the thread path when the signal changes', async () => {
    const threadId = signal<string | null>(null);
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] } as never])] });
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate');
    TestBed.runInInjectionContext(() => injectThreadRouting({ threadId }));
    threadId.set('xyz');
    TestBed.tick?.();
    expect(navSpy).toHaveBeenCalledWith(['/', 'xyz'], expect.objectContaining({ queryParamsHandling: 'preserve' }));
  });

  it('redirects to bare when validate() rejects the id', async () => {
    const threadId = signal<string | null>(null);
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] } as never])] });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dead');
    const navSpy = vi.spyOn(router, 'navigate');
    TestBed.runInInjectionContext(() =>
      injectThreadRouting({ threadId, validate: async () => false }),
    );
    await Promise.resolve();
    TestBed.tick?.();
    expect(navSpy).toHaveBeenCalledWith(['/'], expect.objectContaining({ replaceUrl: true }));
  });

  it('treats a bare URL as no thread (null, no navigate)', async () => {
    const threadId = signal<string | null>(null);
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] } as never])] });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    TestBed.runInInjectionContext(() => injectThreadRouting({ threadId }));
    TestBed.tick?.();
    expect(threadId()).toBeNull();
  });

  it('uses custom toCommands/threadIdFromUrl (mode-prefixed) round-trip', async () => {
    const threadId = signal<string | null>(null);
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] } as never])] });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed/t1');
    const navSpy = vi.spyOn(router, 'navigate');
    TestBed.runInInjectionContext(() =>
      injectThreadRouting({
        threadId,
        threadIdFromUrl: (u) => u.split('?')[0].split('/').filter(Boolean)[1] ?? null,
        toCommands: (id) => (id ? ['/', 'embed', id] : ['/', 'embed']),
      }),
    );
    TestBed.tick?.();
    expect(threadId()).toBe('t1');
    threadId.set('t2');
    TestBed.tick?.();
    expect(navSpy).toHaveBeenCalledWith(['/', 'embed', 't2'], expect.anything());
  });
});
```
NOTE: the exact TestBed flush API in this repo's Angular 21 may be `TestBed.tick()` or `await router navigation + fixture.detectChanges()`. Adjust the flush mechanism to what the repo uses (check an existing router-using chat spec). The ASSERTIONS are the contract; adapt the harness plumbing so they run.

- [ ] **Step 2: Run — expect FAIL** (`npx nx test chat --skip-nx-cache -- thread-routing`): module missing.

- [ ] **Step 3: Implement** — `libs/chat/src/lib/routing/thread-routing.ts`. Generalize the three effects from `examples/chat`'s `demo-shell.component.ts` (`urlState`/`urlThreadId` + the URL→signal effect at ~165, the signal→URL effect at ~202, and the validation/redirect effect at ~189):
```ts
// SPDX-License-Identifier: MIT
import { effect, inject, untracked, type WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, NavigationEnd, type NavigationExtras } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';

export interface ThreadRoutingConfig {
  /** The app-owned source-of-truth signal for the active thread id. */
  threadId: WritableSignal<string | null>;
  /** Router commands for a thread id (or the bare/welcome path when null).
   *  Default: `(id) => (id ? ['/', id] : ['/'])`. */
  toCommands?: (id: string | null) => unknown[];
  /** Extract the thread id from a URL (null = bare). Default: last non-empty path segment. */
  threadIdFromUrl?: (url: string) => string | null;
  /** Optional async validity check; on `false` the helper redirects to the bare path
   *  (`replaceUrl: true`). LangGraph apps pass `id => threads.getThread(id).then(Boolean)`. */
  validate?: (id: string) => Promise<boolean>;
  /** Extras merged into every navigate (default `{ queryParamsHandling: 'preserve' }`). */
  navigationExtras?: NavigationExtras;
}

const defaultFromUrl = (url: string): string | null => {
  const seg = url.split('?')[0].split('#')[0].split('/').filter(Boolean);
  return seg.length ? seg[seg.length - 1] : null;
};
const defaultToCommands = (id: string | null): unknown[] => (id ? ['/', id] : ['/']);

/**
 * Bind an app-owned `activeThreadId` signal to the URL — restore on load, stamp on change,
 * validate-or-redirect, with a bare URL meaning "no thread" (welcome). URL is the source of
 * truth; nothing is written to localStorage. Must be called in an injection context.
 *
 * @example
 * ```ts
 * export const ACTIVE_THREAD = signal<string | null>(null);
 * // providers: provideAgent({ threadId: ACTIVE_THREAD, onThreadId: id => ACTIVE_THREAD.set(id) })
 * const threads = inject(LangGraphThreadsAdapter);
 * injectThreadRouting({ threadId: ACTIVE_THREAD, validate: id => threads.getThread(id).then(Boolean) });
 * ```
 */
export function injectThreadRouting(config: ThreadRoutingConfig): void {
  const router = inject(Router);
  const fromUrl = config.threadIdFromUrl ?? defaultFromUrl;
  const toCommands = config.toCommands ?? defaultToCommands;
  const extras: NavigationExtras = config.navigationExtras ?? { queryParamsHandling: 'preserve' };

  // URL → signal (re-fires on every NavigationEnd: back/forward, programmatic nav).
  const urlThreadId = toSignal(
    router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => fromUrl(e.urlAfterRedirects)),
      startWith(fromUrl(router.url)),
    ),
    { initialValue: fromUrl(router.url) },
  );

  // Seed the signal from the URL once, then keep it in sync.
  config.threadId.set(urlThreadId());

  effect(() => {
    const urlId = urlThreadId();
    if (urlId !== untracked(() => config.threadId())) config.threadId.set(urlId);
  });

  // signal → URL.
  effect(() => {
    const id = config.threadId();
    const urlId = untracked(() => urlThreadId());
    if (id !== urlId) void router.navigate(toCommands(id), extras);
  });

  // validate stale ids → redirect to bare.
  if (config.validate) {
    const validate = config.validate;
    effect(() => {
      const id = urlThreadId();
      if (!id) return;
      void validate(id).then((ok) => {
        if (!ok && untracked(() => urlThreadId()) === id) {
          void router.navigate(toCommands(null), { ...extras, replaceUrl: true });
        }
      });
    });
  }
}
```

- [ ] **Step 4: Run — expect PASS** (`npx nx test chat --skip-nx-cache -- thread-routing`). Fix the harness flush plumbing until the 5 assertions pass.

- [ ] **Step 5: Export** — in `libs/chat/src/public-api.ts` add:
```ts
export { injectThreadRouting } from './lib/routing/thread-routing';
export type { ThreadRoutingConfig } from './lib/routing/thread-routing';
```

- [ ] **Step 6: Verify + commit.**
```bash
npx nx run-many -t test lint build --projects=chat --skip-nx-cache   # green
git add libs/chat/src/lib/routing libs/chat/src/public-api.ts
git commit -m "feat(chat): injectThreadRouting — reusable URL<->active-threadId binding"
```

---

## Task 2: Refactor `examples/chat` onto the helper

**Files:** `examples/chat/angular/src/app/shell/demo-shell.component.ts`

- [ ] **Step 1: Replace the hand-rolled sync.** Read the shell. It has module-scope `threadIdState`, a `urlState`/`urlThreadId` `toSignal`, a `parseUrl(mode + threadId)`, the URL→signal effect, the signal→URL effect (mode-prefixed commands), and a `getThread`-based validation/redirect effect. Replace the three thread effects + the `threadIdSignal` seeding with a single `injectThreadRouting` call, passing `toCommands`/`threadIdFromUrl` that preserve the mode prefix and `validate` via `threadsSvc.getThread`. KEEP: the `mode` computed (still needed for the UI + mode-switch nav), the knob query-param effects (unrelated), the `threadActions` adapter, `refreshOnRunEnd`, the route UrlMatcher (unchanged). `threadIdSignal` becomes the app-owned `threadIdState` passed to the helper.
```ts
injectThreadRouting({
  threadId: threadIdState,
  threadIdFromUrl: (u) => parseUrl(u).threadId,
  toCommands: (id) => (id ? ['/', this.mode(), id] : ['/', this.mode()]),
  validate: (id) => this.threadsSvc.getThread(id).then(Boolean),
});
```
Keep `parseUrl` (used by `mode` computed + `threadIdFromUrl`). Delete the now-redundant URL→signal, signal→URL, and validation effects + the `urlThreadId` private signal if only used by them (keep `urlState`/`mode`).
NOTE: `this.mode()` inside `toCommands` — `mode` is derived from the URL; on a thread-switch the mode hasn't changed, so commands stay in the current mode. Confirm `mode` is readable at helper-call time (it is — it's a computed on `urlState`).

- [ ] **Step 2: Verify build + the thread-routing e2e stays green.**
```bash
npx nx build examples-chat-angular --skip-nx-cache
# free ports 4200/4201/2024 first
npx nx e2e examples-chat-angular --skip-nx-cache -- --grep "thread|route|url"
```
Expected: PASS — load thread route, switch updates URL, back/forward, agent-allocated id survives. If no thread-routing e2e exists, run the full examples-chat e2e and confirm no regression; note coverage.

- [ ] **Step 3: Commit.**
```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts
git commit -m "refactor(examples/chat): adopt injectThreadRouting (delete hand-rolled URL<->thread sync)"
```

---

## Task 3: Adopt in the cockpit thread demos

**Files:**
- `cockpit/chat/threads/angular/src/app/*` (component + app.config + routes)
- `cockpit/langgraph/persistence/angular/src/app/*`

- [ ] **Step 1: `cockpit/chat/threads`.** It uses an in-memory `activeThreadIdState` signal + `LangGraphThreadsAdapter`. Add a route param if the app has no router (use a simple `/:threadId?` route or a UrlMatcher), wire `provideAgent({ threadId: activeThreadIdState, onThreadId: id => activeThreadIdState.set(id) })` (likely already present), and in the component call `injectThreadRouting({ threadId: activeThreadIdState, validate: id => threadsSvc.getThread(id).then(Boolean) })`. The thread now survives reload + is shareable. Keep the sidenav/thread-list wiring + `threadActions`.

- [ ] **Step 2: `cockpit/langgraph/persistence`.** Adopt the helper the same way. ALSO replace the ad-hoc `onThreadId` list-tracking (`threadsState` built manually in the callback) with `LangGraphThreadsAdapter.threads()` (inject the adapter, use its signal for the picker, drop the manual counter). `onThreadId` now only sets the active-thread signal (the helper handles the URL; the adapter handles the list).

- [ ] **Step 3: Verify builds.**
```bash
npx nx run-many -t build --projects=cockpit-chat-threads-angular,cockpit-langgraph-persistence-angular --skip-nx-cache
```

- [ ] **Step 4: Reload-survival e2e for one app.** Add/extend an e2e for `cockpit/chat/threads`: send a message (thread auto-created → URL stamped), reload the page, assert the conversation is restored (messages present) from the URL. Free ports first; run `npx nx e2e cockpit-chat-threads-angular`. If the cockpit app has no e2e harness, note that and rely on the examples/chat e2e + the unit tests for the helper.

- [ ] **Step 5: Commit.**
```bash
git add cockpit/chat/threads/angular cockpit/langgraph/persistence/angular
git commit -m "feat(cockpit): adopt injectThreadRouting in threads + persistence demos (reload-survival + adapter list)"
```

---

## Task 4: AG-UI spike → conditional wire

**Files:** `examples/ag-ui/angular/*` (only if the spike is positive)

- [ ] **Step 1: Spike.** Determine whether the itinerary AG-UI server restores a conversation when `HttpAgent` is constructed with a prior `threadId`. Read `examples/ag-ui/python/src/*` (does it persist messages/state keyed by thread id?) and the AG-UI client `HttpAgent` threadId handling. Optionally serve + manually verify (start a thread, note its id, reload with the id, see if history returns). Write your finding.

- [ ] **Step 2a: If positive** — wire `examples/ag-ui` like the LangGraph apps: app-owned `ACTIVE_THREAD` signal, `provideAgent({ url, threadId: ACTIVE_THREAD, /* onThreadId if AG-UI exposes it */ })`, and `injectThreadRouting({ threadId: ACTIVE_THREAD })` (no `validate` unless AG-UI offers a getThread). Build + smoke.

- [ ] **Step 2b: If negative** — do NOT add thread UI. Add a one-paragraph note in `examples/ag-ui/angular` (a code comment in the shell + a line in the thread-routing doc) stating the AG-UI itinerary server does not persist conversations by thread id, so the demo is intentionally ephemeral.

- [ ] **Step 3: Commit** (whichever path).
```bash
git add examples/ag-ui/angular docs
git commit -m "test(examples/ag-ui): <wire thread routing | document intentional ephemerality> per AG-UI thread-persistence spike"
```

---

## Task 5: Thread-routing docs guide

**Files:** a new guide under `apps/website/content/docs/` (chat or langgraph guides section — match where thread/sidenav docs live).

- [ ] **Step 1: Write the guide.** Document URL-as-source-of-truth + `injectThreadRouting`: the app-owned signal + `provideAgent` wiring, the helper call, `toCommands`/`threadIdFromUrl` for custom paths, `validate` for stale links, and the doctrine (no localStorage for the active thread; bare = welcome). Include the canonical snippet. Reference the existing `2026-05-20-url-thread-routing-design.md` doctrine. If the docs render `api-docs.json`, regenerate so `injectThreadRouting` appears.

- [ ] **Step 2: Commit.**
```bash
git add apps/website/content/docs
git commit -m "docs: thread-routing guide (injectThreadRouting + URL-as-source-of-truth)"
```

---

## Task 6: Full verification + review + PR

- [ ] **Step 1: Full gate.** `npx nx run-many -t test lint build --projects=chat --skip-nx-cache`; build the adopting apps (`examples-chat-angular`, `cockpit-chat-threads-angular`, `cockpit-langgraph-persistence-angular`, and `examples-ag-ui-angular` if wired). e2e green where run.
- [ ] **Step 2: Final whole-implementation code review** (most-capable): helper correctness (no URL↔signal loop; validate race uses the untracked re-check; bare=welcome; defaults), the examples/chat refactor is behavior-identical, the cockpit adoptions don't regress, no internal-type leak in the public `injectThreadRouting`/`ThreadRoutingConfig`.
- [ ] **Step 3: Open PR** against main, regenerate `api-docs` + commit if changed, enable auto-merge; if `BEHIND`, update from main (the self-healing pattern) and re-verify.
- [ ] **Step 4: Finish** via `superpowers:finishing-a-development-branch`.

---

## Self-Review (against the spec)

- **Coverage:** helper + tests + export (Task 1) ✓; examples/chat refactor (Task 2) ✓; cockpit adoption incl. persistence→adapter-list (Task 3) ✓; AG-UI verify-then-decide (Task 4) ✓; docs (Task 5) ✓; verify+PR (Task 6) ✓.
- **Type consistency:** `injectThreadRouting`, `ThreadRoutingConfig` (`threadId`/`toCommands`/`threadIdFromUrl`/`validate`/`navigationExtras`) used consistently; defaults (`defaultFromUrl`/`defaultToCommands`) match the spec.
- **No placeholders:** helper implementation is complete; the one harness-flush detail (`TestBed.tick` vs fixture) is explicitly flagged for the implementer to match the repo, with the assertions as the fixed contract; the AG-UI branch is conditional-by-design, not a TBD.
