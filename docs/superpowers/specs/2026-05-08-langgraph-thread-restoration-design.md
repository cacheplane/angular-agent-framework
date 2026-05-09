# `@ngaf/langgraph` Thread Restoration on Reconnect

**Date:** 2026-05-08
**Status:** Approved
**Surfaced by:** live-Chrome smoke pass against `examples/chat` after PR #218 merged (`a97721f7` on `origin/main`).

## Goal

Make `agent({ threadId })` actually restore the full conversation state when reconnecting to an existing thread. The Phase 1 spec (PR #213) explicitly listed reload-mid-conversation as a feature. It currently does not work — only `history$` is populated; the chat composition reads `messages$`.

## The bug

**Reproduction (currently broken on `origin/main`):**

1. Open `examples/chat` at `/embed`.
2. Send a message — the demo creates a server thread; `onThreadId` writes the thread id to `localStorage` under key `ngaf-chat-demo:palette`.
3. Reload the page (Cmd+R).
4. The demo shell rehydrates `threadIdSignal` from `localStorage` and passes the persisted id to `agent({ threadId: this.threadIdSignal })`.
5. The bridge sees the threadId and calls `refreshHistory()`, which fetches the checkpoint history into `subjects.history$`.
6. **But** `subjects.messages$` stays at `[]`, so the chat composition shows the welcome state. Conversation appears lost.

Verified live just now: `localStorage` retained the threadId (`019e0a1c-2287-...`); `document.querySelectorAll('chat-message').length === 0`; the welcome heading "How can I help?" was visible.

## Root cause

`stream-manager.bridge.ts` `refreshHistory()`:

```ts
async function refreshHistory(): Promise<void> {
  const getHistory = transport.getHistory?.bind(transport);
  if (!currentThreadId || !getHistory) return;

  // ...AbortController setup...

  try {
    const history = await getHistory(threadId, controller.signal);
    if (!controller.signal.aborted && currentThreadId === threadId) {
      subjects.history$.next(history as ThreadState<T>[]);  // ← only history$
    }
  } catch (err) { /* ... */ }
}
```

Only `history$` is populated. The chat composition reads `messages$` (via `agent.messages()`), so the user sees nothing. `values$` is also unpopulated — meaning state fields beyond messages (e.g. `state.model`, `state.reasoning_effort`) wouldn't restore either, although the demo currently mirrors those in `localStorage` so the practical user impact is just the missing message bubbles.

## Approach

Extend `refreshHistory()` to project the most recent checkpoint into `messages$` and `values$` after the history fetch resolves. Guarded so it doesn't clobber local optimistic state if the user submitted in the gap before history fetched.

### The fix

```ts
async function refreshHistory(): Promise<void> {
  const getHistory = transport.getHistory?.bind(transport);
  if (!currentThreadId || !getHistory) return;

  historyAbortController?.abort();
  const controller = new AbortController();
  historyAbortController = controller;
  const threadId = currentThreadId;
  subjects.isThreadLoading$.next(true);

  try {
    const history = await getHistory(threadId, controller.signal);
    if (!controller.signal.aborted && currentThreadId === threadId) {
      subjects.history$.next(history as ThreadState<T>[]);

      // Project the latest checkpoint into messages$ + values$ on first
      // load. The user expectation (per the Phase 1 examples/chat demo
      // spec) is that reloading mid-conversation reattaches to the
      // existing thread and the history reappears. Guard: only populate
      // when messages$ is currently empty, so we don't overwrite
      // optimistic local state if the user already submitted a message
      // in the gap between threadId-set and history-fetched.
      const latest = history[0] as { values?: { messages?: BaseMessage[] } & T } | undefined;
      if (latest?.values && subjects.messages$.value.length === 0) {
        const restoredMessages = latest.values.messages ?? [];
        const restoredValues = { ...(latest.values as T) };
        // Strip messages from values — messages$ is the canonical surface
        // for them; keeping a duplicate in values$ would confuse downstream
        // consumers that read both subjects.
        delete (restoredValues as { messages?: unknown }).messages;
        subjects.messages$.next(restoredMessages);
        subjects.values$.next(restoredValues);
      }
    }
  } catch (err) {
    if (!controller.signal.aborted && (err as Error)?.name !== 'AbortError') {
      subjects.error$.next(err);
    }
  } finally {
    if (historyAbortController === controller) {
      historyAbortController = null;
      subjects.isThreadLoading$.next(false);
    }
  }
}
```

Net change: ~12 LOC added inside the existing `if (!controller.signal.aborted && currentThreadId === threadId)` block. No new functions, no new exports, no behaviour change to any other surface.

### Race conditions (handled)

Three things race during init when `threadId` is non-null:

1. `threadId$` emits the persisted id → `setThreadId(id, false)` → triggers `refreshHistory()`.
2. The user clicks Send before history fetches → `submit()` mutates `messages$`.
3. History resolves → wants to project to `messages$`.

The guard `subjects.messages$.value.length === 0` makes #3 only fire when #2 hasn't yet. Practical effect: #2 (a user click typically taking >300ms after page paint) usually fires AFTER #3 (refreshHistory typically <100ms), so the common case is #3 wins, restoring history. In the rare case where the user clicks send before history resolves, the local optimistic message stays, history is silently skipped, and the conversation continues from the user's local state.

### Approaches considered and rejected

- **Expose `agent.restoreFromHistory()` for consumers to call.** Breaks the abstraction. The Phase 1 spec already promised auto-restore as default behaviour. Rejected.
- **Opt-in via `agent({ restoreOnInit: true })`.** Adds a knob to a feature that should be the default. Nobody is relying on the broken behaviour. Rejected.

## Tests

Add to `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts`:

```ts
it('populates messages$ from the latest checkpoint on initial connect', async () => {
  const transport = new MockAgentTransport();
  transport.history = [
    { values: { messages: [
      { type: 'human', id: 'u-1', content: 'previous question', _getType: () => 'human' },
      { type: 'ai',    id: 'a-1', content: 'previous answer',   _getType: () => 'ai' },
    ] } },
  ];

  const subjects = makeSubjects();
  const destroy$ = new Subject<void>();
  createStreamManagerBridge({
    options: { apiUrl: '', assistantId: 'chat', transport },
    subjects,
    threadId$: of('persisted-thread-1'),
    destroy$: destroy$.asObservable(),
  });

  await new Promise(r => setTimeout(r, 10));

  expect(subjects.messages$.value.length).toBe(2);
  expect((subjects.messages$.value[1] as { content: unknown }).content).toBe('previous answer');
});

it('does not clobber local optimistic messages if a submit beats the history fetch', async () => {
  const transport = new MockAgentTransport();
  // delay history so submit wins the race
  transport.getHistoryDelayMs = 50;
  transport.history = [
    { values: { messages: [
      { type: 'human', id: 'old', content: 'old', _getType: () => 'human' },
    ] } },
  ];

  const subjects = makeSubjects();
  const destroy$ = new Subject<void>();
  createStreamManagerBridge({
    options: { apiUrl: '', assistantId: 'chat', transport },
    subjects,
    threadId$: of('persisted-thread-2'),
    destroy$: destroy$.asObservable(),
  });

  // simulate optimistic local submit BEFORE history resolves
  subjects.messages$.next([
    { type: 'human', id: 'fresh', content: 'fresh prompt', _getType: () => 'human' },
  ] as never);

  await new Promise(r => setTimeout(r, 60));

  // local message preserved; history NOT projected because guard fired
  expect(subjects.messages$.value.length).toBe(1);
  expect((subjects.messages$.value[0] as { content: unknown }).content).toBe('fresh prompt');
});
```

The first test requires `MockAgentTransport.history` to be settable (likely already is via the `historyCalls`/`history` fixture pattern in the existing transport mock; if not, add a 1-line setter). The second test additionally needs `getHistoryDelayMs` — adding `await new Promise(r => setTimeout(r, this.getHistoryDelayMs ?? 0))` inside the mock's `getHistory()` is a small extension.

The existing test at `it('loads history when initialized with a thread id', ...)` continues to pass — it asserts only that `history$` gets populated, which still happens.

## Demo-side: nothing changes

`examples/chat/angular/src/app/shell/demo-shell.component.ts` already initialises `threadIdSignal` from `persistence.read('threadId')` and passes it into `agent({ threadId: this.threadIdSignal })`. That code is correct as-is. The fix is entirely inside the adapter.

## Out of scope (defer)

- **Restoring custom palette state from server values.** The demo uses `state.model` and `state.reasoning_effort`. Both are mirrored in `localStorage` via `palette-persistence.service.ts`, so the user-visible behaviour (palette reflects the persisted choice) already works. Reading them back from `values$` after restore would be more correct philosophically, but adds plumbing in the demo for no observable user benefit. Defer.
- **Migrating the entire chat composition to consume `history$` directly.** That would be a different (and much larger) architectural change.
- **Multi-thread switcher.** The reload case is single-thread. Switching between persisted threads is a Phase 5+ feature.

## Files touched

| Path | Change |
|---|---|
| `libs/langgraph/src/lib/internals/stream-manager.bridge.ts` | extend `refreshHistory` to populate `messages$` + `values$` from the latest checkpoint (~12 LOC) |
| `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts` | +2 unit tests pinning the restore path and the race-guard |
| `libs/langgraph/src/lib/transport/mock-stream.transport.ts` (if needed) | tiny extension: `history` setter and optional `getHistoryDelayMs` (≤5 LOC) |

Total ≈ 65 LOC.

## Definition of done

1. PR merged.
2. CI green: `nx run langgraph:test` shows the 2 new tests passing alongside the existing 53.
3. Live smoke (manual, against the workspace `examples/chat` demo): send a message → reload → conversation reappears with the prior user/assistant exchange visible. No flash of welcome state.
4. Cross-mode reload still works: send in `/embed`, reload, switch to `/popup`, open popup — the prior conversation shows in the popup.

## Risks

- **Race with optimistic submit beating history fetch.** Mitigated by the `messages$.value.length === 0` guard. Pinned by the second unit test.
- **History fetch fails silently.** Existing behaviour preserved — error goes to `error$`, `messages$` stays empty, welcome state shows. User can retry by sending a new message.
- **Thread exists but has no messages (just metadata).** `latest.values.messages` is `[]`. Guard still passes; `messages$.next([])` is a no-op. Welcome state remains. Acceptable.
- **Latest checkpoint has stale messages relative to a concurrently running stream.** The bridge's existing in-flight stream logic handles this: any active stream's incoming chunks merge through `mergeMessages` against `messages$`. If we just restored an empty messages$ then a streaming chunk arrives, mergeMessages handles it as "first chunk for this AI". If we restored 2 messages and a new chunk arrives for a 3rd, the merge appends correctly. No new race introduced.
