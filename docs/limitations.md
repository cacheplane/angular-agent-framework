# Angular Agent Framework — Limitations vs React useStream()

Features that are technically impossible or behaviorally degraded when
 porting LangGraph's React `useStream()` hook to Angular.

Each entry: **Feature** | React behavior | Angular behavior | Workaround

---

## 1. Concurrent-Mode Atomic Batching

**React behavior:** `useSyncExternalStore` in React's concurrent renderer
batches multiple state updates arriving in the same frame into a single
re-render. Consumers never see intermediate states.

**Angular behavior:** Each `BehaviorSubject.next()` call triggers a
separate signal update and potentially a separate change detection cycle.
Rapid token-by-token streaming may produce more intermediate renders than
the React equivalent.

**Workaround:** Use the `throttle` option to coalesce rapid updates:
`agent({ throttle: 50, ... })`. This applies
`throttleTime(50ms, { leading: true, trailing: true })` to the `values$`
and `messages$` streams.

---

## 2. React Server Components

**React behavior:** LangGraph UI components can render on the server
via React Server Components, enabling SSR of streamed AI responses.

**Angular behavior:** `agent()` requires a browser environment
and an injection context. Angular has no equivalent of React Server
Components. Server-side rendering of streaming content is not supported.

**Workaround:** None. Use client-side rendering with loading states.

---

## 3. StrictMode Double-Invocation

**React behavior:** React's `StrictMode` invokes hooks twice in
development to detect side effects. Tests written expecting this behavior
will not port directly.

**Angular behavior:** Angular has no `StrictMode` double-invocation
equivalent. `agent()` is called once. No behavioral impact.

**Workaround:** Not needed. Simply omit double-invocation assumptions
from ported test patterns.

---
