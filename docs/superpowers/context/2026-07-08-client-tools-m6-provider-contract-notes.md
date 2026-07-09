# Client Tools M6 Provider Contract Notes

**Date:** 2026-07-08  
**Threadplane branch:** `blove/client-tools-m6-provider-discovery`  
**Provider source inspected:** `/Users/blove/repos/hashbrown`  
**Provider source commit inspected:** `c7b10d419ea9350cfcb701e9d0a0adb1922bfc92`  
**Provider package versions inspected:** `@hashbrownai/core@0.5.0-beta.4`, `@hashbrownai/angular@0.5.0-beta.4`

These notes execute the M6 discovery step from `docs/superpowers/plans/2026-07-08-client-tools-m6-agent-bridge-plan.md`. The source repository was read-only during discovery; no provider files or secrets were modified or read.

## Summary

The provider source does not currently expose an AG-UI `AbstractAgent`-style event subscriber. It exposes:

- a headless core chat object from `fryHashbrown(...)`;
- Angular resources (`chatResource`, `structuredChatResource`, `uiChatResource`) that wrap that core object in Angular signals;
- an internal transport frame protocol that is decoded inside the core runtime before state is exposed.

That points to a bespoke Threadplane `Agent` adapter over the provider chat/resource state, not reuse of `libs/ag-ui/src/lib/reducer.ts`.

## Source And Construction API

Primary source files:

- `/Users/blove/repos/hashbrown/packages/core/src/hashbrown.ts`
- `/Users/blove/repos/hashbrown/packages/angular/src/resources/chat-resource.fn.ts`
- `/Users/blove/repos/hashbrown/packages/angular/src/resources/structured-chat-resource.fn.ts`
- `/Users/blove/repos/hashbrown/packages/angular/src/resources/ui-chat-resource.fn.ts`
- `/Users/blove/repos/hashbrown/packages/core/src/frames/frame-types.ts`
- `/Users/blove/repos/hashbrown/packages/core/src/effects/generate-message.effects.ts`

Core construction:

```ts
fryHashbrown({
  apiUrl,
  model,
  system,
  messages,
  tools,
  responseSchema,
  structuredOutput,
  middleware,
  emulateStructuredOutput,
  debounce,
  retries,
  transport,
  ui,
  threadId,
})
```

Angular construction:

```ts
chatResource(options)
structuredChatResource(options)
uiChatResource(options)
```

Angular setup also supports a DI config via:

```ts
provideHashbrown(...)
```

## Public State Surface

The core `Hashbrown<Output, Tools>` interface exposes:

- `messages`
- `error`
- `isReceiving`
- `isSending`
- `isGenerating`
- `isRunningToolCalls`
- `isLoading`
- `exhaustedRetries`
- `sendingError`
- `generatingError`
- `lastAssistantMessage`
- thread flags and thread errors
- `threadId`

Control methods:

- `setMessages(messages)`
- `sendMessage(message)`
- `resendMessages()`
- `updateOptions(options)`
- `stop(clearStreamingMessage?)`
- `sizzle()`

Angular resources convert those state signals into Angular `Signal`s and expose:

- `value` for messages;
- `status`;
- `hasValue`;
- loading/error signals;
- `sendMessage`;
- `setMessages` on chat and structured chat resources;
- `resendMessages` on structured and UI chat resources;
- `reload`;
- `stop`;
- `lastAssistantMessage`.

## Transport Frame Contract

The internal frame protocol in `packages/core/src/frames/frame-types.ts` is:

| Frame | Payload |
| --- | --- |
| `generation-start` | none |
| `generation-chunk` | `chunk: Chat.Api.CompletionChunk` |
| `generation-error` | `error`, optional `stacktrace` |
| `generation-finish` | none |
| `thread-load-start` | none |
| `thread-load-success` | optional `thread: Chat.Api.Message[]` |
| `thread-load-failure` | `error`, optional `stacktrace` |
| `thread-save-start` | none |
| `thread-save-success` | `threadId` |
| `thread-save-failure` | `error`, optional `stacktrace` |

These frames are decoded by `generate-message.effects.ts` and reduced into provider state. They are not equivalent to AG-UI runtime events:

- there is no public `subscribe({ onEvent })` API on the Angular resource surface;
- generation chunks preserve OpenAI-style completion deltas, not AG-UI event names such as `TEXT_MESSAGE_START` or `TOOL_CALL_START`;
- tool execution is internal and post-assistant-turn, not projected as a Threadplane `ClientToolsCapability` pending queue.

## Message And Tool Model

Provider API messages:

- `user`: `{ role: 'user', content: string }`
- `assistant`: `{ role: 'assistant', content?: string, toolCalls?: ToolCall[] }`
- `tool`: `{ role: 'tool', content: PromiseSettledResult<any>, toolCallId, toolName }`
- `error`: `{ role: 'error', content: string }`

Provider view messages:

- `user`: `{ role: 'user', content: JsonValue }`
- `assistant`: `{ role: 'assistant', content?: Output, toolCalls: AnyToolCall[] }`
- `error`: `{ role: 'error', content: string }`

Internal tool calls:

```ts
{
  id: string;
  name: string;
  arguments: string;
  argumentsResolved?: JsonValue;
  result?: PromiseSettledResult<any>;
  progress?: number;
  status: 'pending' | 'done';
}
```

Tool execution is run by `packages/core/src/effects/tools.effects.ts` after `assistantTurnFinalized`. It:

- selects pending internal tool calls;
- finds matching registered tools;
- parses/validates arguments;
- invokes the provider tool handler with `(args, abortSignal)`;
- dispatches `runToolCallsSuccess`;
- marks tool calls `done`;
- causes generation to continue through `internalActions.runToolCallsSuccess`.

## Threadplane Agent Mapping

Likely first adapter target: core `Hashbrown` or Angular `ChatResourceRef`/`StructuredChatResourceRef`.

Threadplane field mapping:

| Threadplane `Agent` field | Provider source |
| --- | --- |
| `messages` | Map provider `messages`/resource `value` |
| `status` | Derive from `isLoading`, `error`, and message presence |
| `isLoading` | Provider `isLoading` |
| `error` | Provider `error`, normalized through Threadplane `toAgentError` |
| `toolCalls` | Flatten assistant `toolCalls` from provider view messages |
| `state` | `{}` initially; no generic state signal is exposed |
| `events$` | `EMPTY` initially; no public event stream exists |
| `submit` | `sendMessage({ role: 'user', content })` |
| `stop` | `stop(clearStreamingMessage?)`, guarding the provider's throw-when-idle behavior |
| `retry` | `resendMessages()` if available; otherwise no-op |
| `regenerate` | `setMessages(trimmed)` followed by resend/reload semantics where available |
| `clientTools` | Do not map initially; provider owns tool execution internally |
| `interrupt` | unsupported/absent initially |
| `subagents` | unsupported/absent initially |

## Reducer Decision

Do not reuse `libs/ag-ui/src/lib/reducer.ts` for the first implementation. The provider stream has a different contract:

- Threadplane AG-UI reducer expects named AG-UI events such as `RUN_STARTED`, `TEXT_MESSAGE_CONTENT`, `TOOL_CALL_ARGS`, `STATE_SNAPSHOT`, `CUSTOM`, and `ACTIVITY_*`.
- The provider exposes a chat/resource state surface and internal transport frames.
- The stable adapter boundary is therefore provider state to Threadplane `Agent`, not provider frames to AG-UI events.

The only plausible AG-UI reuse path would be a future provider feature that explicitly emits AG-UI events or implements AG-UI's `AbstractAgent` API. That was not present in the inspected source.

## Open Questions Before Runtime Code

1. Should the first bridge wrap core `fryHashbrown(...)` directly or wrap Angular `chatResource(...)`/`structuredChatResource(...)`?
   - Core wrapping is framework-neutral but needs state-signal conversion in Threadplane.
   - Angular resource wrapping matches Threadplane's Angular library shape but requires an injection context and may duplicate provider DI configuration.
2. Should the bridge target unstructured chat only first, or also support structured/UI chat from day one?
3. Where should the bridge live?
   - New adapter package is cleanest if it is a public migration bridge.
   - A private internal adapter avoids new public exports until the API is proven.
4. How should provider-managed tools relate to Threadplane `ClientToolsCapability`?
   - First recommendation: do not expose a Threadplane client-tools capability. Let provider tools remain provider-owned.
   - A later bridge could translate provider tool definitions into Threadplane `action`/`view`/`ask`, but only if product direction requires Threadplane to own the client-tool loop.
5. Should `regenerate` use `setMessages(trimmed)` plus `resendMessages()`, or mimic the provider resource `reload()` behavior that only removes the last assistant response?

## Recommended Next PR

Implement a small, private proof-of-contract adapter test before any public API:

1. Create a local fake `Hashbrown`/resource object in a Threadplane spec.
2. Write conformance tests for mapping provider state into Threadplane `Agent`:
   - initial idle state;
   - user submit;
   - loading/status projection;
   - assistant message projection;
   - error projection;
   - stop while idle is swallowed/no-op;
   - retry delegates to provider resend where available;
   - regenerate trims messages and resends when supported.
3. Implement the smallest private adapter helper inside the spec or an internal module.
4. Do not add public exports or dependencies yet.

This keeps M6 moving while preserving the spec constraint that productized public surface waits until the provider boundary is proven.
