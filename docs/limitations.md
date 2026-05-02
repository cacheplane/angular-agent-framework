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

## 4. `experimental_branchTree`

**React behavior:** `useStream()` exposes `experimental_branchTree` — a
`Sequence<StateType>` for visualizing the full branch tree of a thread.

**Angular behavior:** This feature is marked experimental in the React
SDK and depends on internal tree-diffing utilities not exported from
`@langchain/langgraph-sdk/ui`. It is not implemented in v1.

**Workaround:** Use `branch` (Signal<string>) and `history`
(Signal<ThreadState[]>) to reconstruct branch relationships manually.

---

## 5. `queue` (QueueInterface)

**React behavior:** `useStream()` exposes a `queue` property
(`QueueInterface`) for inspecting and managing the pending submission queue.

**Angular behavior:** Queue management is handled internally in the
bridge but not exposed as a public signal in v1. The queue drains
automatically on `submit()` calls.

**Workaround:** None in v1. Use `isLoading()` to gate UI interactions.

---

### Limitation: subagent helper methods are not exposed

**Feature:** `getSubagent()` / `getSubagentsByType()` /
`getSubagentsByMessage()`

**React behavior:** `useStream()` exposes helper methods for looking up
subagent streams by tool call ID, subagent type, or triggering message.

**Angular behavior:** `subagents()` and `activeSubagents()` are implemented.
Use the `subagents()` map directly for lookups. Helper methods can be added
later if Angular consumers need parity beyond the signal surface.

**Workaround:** Read from `subagents().get(toolCallId)` or filter
`[...subagents().values()]` in a computed signal.
