# Streaming Markdown Lifecycle Design

## Objective

Make streaming Markdown deterministic from token ingestion through Angular DOM rendering. The upstream parser must expose one canonical visible graph, and the Angular renderer must finalize that graph from an authoritative lifecycle transition rather than elapsed silence.

This intentionally breaks the existing `ChatStreamingMdComponent` input contract. Backwards compatibility is not required.

## Problems

The current parser has two representations of an open line:

- `parser.root` projects the open line through the Markdown block and inline grammar.
- `push()` also synthesizes a root text node with `id: -1` for selected buffered lines.

The synthetic path duplicates structural classification. It has already leaked code-fence delimiters and still reports thematic breaks such as `---` as text while `parser.root` reports a thematic-break node.

The Angular component separately accepts `content` and `streaming`. It does not receive an authoritative terminal event, so it waits 600 ms after content becomes quiet before calling `finish()`. This creates timing-dependent behavior and permits phase/content input-order races.

## Upstream Parser Architecture

### Canonical visible graph

`PartialMarkdownParser.root` is the only representation of visible Markdown. Both committed nodes and the projected open line live in this graph. No synthetic node or reserved `id: -1` path exists.

The parser maintains a stable projected mirror between pushes. A push applies the chunk to the internal state machine, builds the next projected graph, and reconciles it against the prior projected graph.

Nodes match when parser ID, node type, parent ID, and sibling index match. A projected node that later commits with the same match retains its public object identity and ID. A grammar reinterpretation that changes any matching field replaces the subtree: removed nodes complete in post-order, then replacement nodes are created in pre-order. Ordinary scalar updates and status transitions are emitted in pre-order after creations. These ordering rules apply within one `push()` or `finish()` result.

`materialize(root)` continues to provide structurally shared immutable snapshots for signal-based consumers.

### Event contract

`push()` and `finish()` return events derived from the same reconciliation that updates `root`:

- `node-created`: a node became visible in `root`.
- `value-updated`: a visible node retained identity and a scalar value grew or changed.
- `node-completed`: a visible node transitioned to `complete`, or left the visible graph because its subtree was reinterpreted.

Every event node must be reachable from the current root, except a `node-completed` event for a node removed during that operation. No negative or reserved public node IDs are used.

Event and root behavior must be partition-invariant. Feeding a prefix as one chunk or character by character must produce normalized trees with the same IDs, types, values, status, and hierarchy. Event batching and `delta` segmentation may differ by chunk partition, but replaying each event stream must end with that same graph; each ID may be created once, updated only while live, and completed at most once unless a grammar reinterpretation explicitly replaces it with a different type or position.

### Structural coverage

The invariant suite covers plain paragraphs, ATX headings, thematic breaks, indented and fenced code, blockquotes, nested lists, GFM tables, display math, HTML blocks, and mixed documents. Delimiters that belong to projected structural nodes must never appear as sibling text events.

## Angular Renderer Contract

### Atomic input

`ChatStreamingMdComponent` accepts one required input:

```ts
export interface StreamingMarkdownDocument {
  readonly generation: string;
  readonly phase: 'streaming' | 'complete';
  readonly content: string;
}
```

The atomic object prevents a transient combination of a new phase with stale content.

`generation` identifies one assistant response attempt. Regeneration or replacement uses a new generation even when it occupies the same message position.

### State transitions

For a generation in `streaming` phase, content is append-only. The component pushes only the appended delta.

On the first `complete` snapshot, the component synchronously pushes any final delta and calls `finish()` exactly once. There is no timer, debounce, or quiet-period inference.

A new generation resets the parser and accepts any content. A shrinking or divergent content value within a streaming generation is a contract violation. A content change after completion within the same generation is also a contract violation. Development builds throw descriptive errors; production rebuilds from the provided atomic snapshot so rendering remains recoverable.

Allowed transitions are explicit:

| Prior state | Next state | Behavior |
| --- | --- | --- |
| none | streaming | Create parser and push content. |
| none | complete | Create parser, push content, and finish once. |
| streaming | streaming, same generation and append-only content | Push only the delta. |
| streaming | complete, same generation and append-only content | Push final delta, then finish once synchronously. |
| complete | complete, identical generation and content | Idempotent no-op. |
| any | streaming or complete, new generation | Replace parser and process the new snapshot. |
| complete | streaming, same generation | Contract violation. |
| complete | complete, changed content | Contract violation. |
| streaming | any, shrinking or divergent content | Contract violation. |

All terminal outcomes use `phase: 'complete'`; the outcome describes why the generation ended but does not change parser finalization.

Static Markdown uses a complete document value. Reasoning and subagent surfaces receive generation and phase from their owning lifecycle rather than supplying defaults that imply timing.

### Lifecycle ownership

The runtime-neutral message contract gains required delivery metadata:

```ts
export type MessageDelivery =
  | {
      readonly generation: string;
      readonly phase: 'streaming';
    }
  | {
      readonly generation: string;
      readonly phase: 'complete';
      readonly outcome: 'success' | 'error' | 'aborted' | 'interrupted' | 'paused';
    };

export interface Message {
  // Existing fields omitted.
  delivery: MessageDelivery;
}
```

Runtime adapters own this state because they observe stream start and termination. Static, restored, user, system, and tool messages use `{ generation: message.id, phase: 'complete', outcome: 'success' }`. Each assistant response attempt receives a new opaque generation at submission, retry, regeneration, resume, or subagent invocation.

Adapter mappings are:

| Runtime event | Delivery state |
| --- | --- |
| First and subsequent chunks for the active attempt | `streaming` |
| Normal run completion | `complete/success` |
| Backend rejection or explicit runtime error event | `complete/error` |
| Transport closes after at least one chunk without a normal terminal event | `complete/interrupted` |
| User stop/cancellation | `complete/aborted` |
| Human-in-the-loop pause | `complete/paused`; resume starts a new generation |
| Retry or regenerate | New generation, initially `streaming` |
| Earlier assistant step when a tool loop advances | `complete/success` before the next step begins |
| Subagent message | Governed by the subagent adapter's own generation and terminal status |

The chat composition derives `StreamingMarkdownDocument` only from message content and `message.delivery`. Reasoning content uses the same generation with a `:reasoning` suffix so it has an independent parser session but the same terminal transition. The renderer never reads agent-global loading state, message position, timers, or wall-clock time.

## Delivery Sequence

1. Implement canonical projected event reconciliation and invariant tests upstream.
2. Build and pack an unreleased `0.5.8` candidate tarball.
3. Install the tarball in Angular, introduce message delivery metadata and the atomic renderer contract, migrate all call sites, and remove the timing heuristic.
4. Extend canonical aimock browser coverage to sample transient blockquote/table states.
5. Run upstream and Angular unit, type, build, Playwright, and Chrome MCP verification against the tarball.
6. Release `@cacheplane/partial-markdown@0.5.8` through OIDC trusted publishing.
7. Replace the tarball dependency with registry `0.5.8`, refresh the lockfile, and rerun focused verification and Chrome MCP smoke tests, including a real-LLM pass when credentials are available locally.

## Verification

Upstream verification includes the complete parser suite, typecheck, build, event/root invariant matrix, chunk-partition properties, and fuzz tests.

Angular verification includes chat unit tests, type tests, package build, canonical example build, focused aimock Playwright tests, and Chrome MCP inspection of tables, blockquote-to-table boundaries, code fences, thematic breaks, completion, and regeneration. Unit tests must prove final-delta-before-finish ordering, exactly-once finish, idempotent repeated completion, generation reset, every invalid transition in development and production behavior, and every terminal outcome mapping. Static checks must prove that Markdown finalization uses no timer API, agent-global loading state, or latest-message inference.

No release is cut while event nodes disagree with the canonical root or while lifecycle behavior depends on wall-clock timing.
