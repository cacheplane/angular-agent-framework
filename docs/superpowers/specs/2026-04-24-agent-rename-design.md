# Rename `ChatAgent` → `Agent` Design

## Goal

Rename the runtime-neutral contract in `@cacheplane/chat` (and its directly-paired types, factories, and test helpers) from `Chat*` to either bare nouns or `Agent*` prefixes. The contract is already domain-neutral; the name should reflect that.

## Motivation

**Naming clarity only.** The contract surface is agent-general: `messages`, `status`, `isLoading`, `toolCalls`, `state`, `submit`, `stop` describe any agent runtime, not specifically chat. Every major agent ecosystem uses `Agent` as the top-level vocabulary:

- **OpenAI Agents SDK** (`@openai/agents`): `Agent`, `Runner`, `Session` — no `ChatAgent`. Responses API explicitly dropped "Chat" from its name.
- **AG-UI** (`@ag-ui/client`): `AbstractAgent`, `HttpAgent`, `LangGraphAgent`.
- **Mastra, CrewAI, Pydantic AI:** `Agent` as top-level class.
- **Microsoft Agent Framework:** `Agent` base, `ChatAgent` as a narrower subclass (precedent for a future sub-interface if needed).
- **LangChain:** `AgentExecutor` / `create*Agent` — no `Chat` prefix on orchestrators (only on LLM chat-completion models: `BaseChatModel`).

Keeping `Chat*` names obscures the contract's generality and cognitively pushes users toward "this is only for chat UIs" when it isn't.

No structural change — this is a rename, not a refactor. No new subclass is introduced.

## Scope

### Contract types (strip `Chat`)

| Old | New |
|---|---|
| `ChatAgent` | `Agent` |
| `ChatAgentWithHistory` | `AgentWithHistory` |

### Data types (bare — no `Chat`, no `Agent`)

| Old | New |
|---|---|
| `ChatMessage` | `Message` |
| `ChatRole` | `Role` |
| `ChatToolCall` | `ToolCall` |
| `ChatToolCallStatus` | `ToolCallStatus` |
| `ChatContentBlock` | `ContentBlock` |
| `ChatSubagent` | `Subagent` |
| `ChatSubagentStatus` | `SubagentStatus` |

Rationale: these align with LangChain/OpenAI/AG-UI vocabulary (which don't prefix message types). `Message` / `ToolCall` / `Role` read naturally in component code.

### Collision-prone types (prefix `Agent`)

| Old | New | Why not bare |
|---|---|---|
| `ChatCustomEvent` | `AgentCustomEvent` | DOM `CustomEvent` is a global type |
| `ChatInterrupt` | `AgentInterrupt` | `@langchain/langgraph-sdk` exports `Interrupt` |
| `ChatStatus` | `AgentStatus` | bare `Status` too generic |
| `ChatSubmitInput` | `AgentSubmitInput` | bare `SubmitInput` generic; pairs with `Agent` |
| `ChatSubmitOptions` | `AgentSubmitOptions` | same |
| `ChatCheckpoint` | `AgentCheckpoint` | `@langchain/langgraph-sdk` exports `Checkpoint` |

### Factories and test helpers

| Old | New |
|---|---|
| `toChatAgent` (in `@cacheplane/langgraph`) | `toAgent` |
| `mockChatAgent` | `mockAgent` |
| `MockChatAgent` | `MockAgent` |
| `MockChatAgentOptions` | `MockAgentOptions` |
| `runChatAgentConformance` | `runAgentConformance` |
| `runChatAgentWithHistoryConformance` | `runAgentWithHistoryConformance` |

### Guard helpers (unchanged)

`isUserMessage`, `isAssistantMessage`, `isToolMessage`, `isSystemMessage` — no `Chat` prefix to strip; keep names.

## File renames

**`libs/chat/src/lib/agent/`**
| Old | New |
|---|---|
| `chat-agent.ts` (+ `.spec.ts`) | `agent.ts` (+ `.spec.ts`) |
| `chat-agent-with-history.ts` | `agent-with-history.ts` |
| `chat-message.ts` (+ `.spec.ts`) | `message.ts` (+ `.spec.ts`) |
| `chat-content-block.ts` | `content-block.ts` |
| `chat-tool-call.ts` | `tool-call.ts` |
| `chat-subagent.ts` | `subagent.ts` |
| `chat-status.ts` | `agent-status.ts` |
| `chat-interrupt.ts` | `agent-interrupt.ts` |
| `chat-submit.ts` | `agent-submit.ts` |
| `chat-custom-event.ts` (+ `.spec.ts`) | `agent-custom-event.ts` (+ `.spec.ts`) |
| `chat-checkpoint.ts` | `agent-checkpoint.ts` |

**`libs/chat/src/lib/testing/`**
| Old | New |
|---|---|
| `mock-chat-agent.ts` (+ `.spec.ts`) | `mock-agent.ts` (+ `.spec.ts`) |
| `chat-agent-conformance.ts` (+ `.spec.ts`) | `agent-conformance.ts` (+ `.spec.ts`) |
| `chat-agent-with-history-conformance.ts` | `agent-with-history-conformance.ts` |

**`libs/langgraph/src/lib/`**
| Old | New |
|---|---|
| `to-chat-agent.ts` | `to-agent.ts` |
| `to-chat-agent.spec.ts` | `to-agent.spec.ts` |
| `to-chat-agent.conformance.spec.ts` | `to-agent.conformance.spec.ts` |

Directory `libs/chat/src/lib/agent/` itself does NOT rename — it's already generic.

## Consumers to update

- `libs/chat/src/lib/agent/index.ts` — re-exports.
- `libs/chat/src/public-api.ts` — exports + import paths.
- `libs/langgraph/src/public-api.ts` — `toChatAgent` → `toAgent` export.
- Every chat primitive + composition (`libs/chat/src/lib/primitives/**`, `libs/chat/src/lib/compositions/**`) — input types and local imports.
- `libs/chat/src/lib/testing/mock-chat-agent.ts` (moved file) — its own type references.
- Cockpit consumers: `cockpit/chat/**` and `cockpit/langgraph/**` where `toChatAgent` / `mockChatAgent` are imported (~25 files from Phase-1).

## Out of scope

- **No backwards-compat aliases.** No `export type ChatAgent = Agent;` shims. Fresh names only.
- **Historical docs** (`docs/superpowers/specs/2026-04-21-*`, `docs/superpowers/plans/2026-04-21-*`) stay as-written. They're artifacts of prior decisions; rewriting them loses the history.
- **No structural changes.** No new subclass. No contract re-shaping. If a `ChatAgent extends Agent` subclass is ever wanted, that's a separate design.
- **Directory rename.** `libs/chat/src/lib/agent/` already uses the neutral name.
- **`@cacheplane/chat` package name.** Stays — the package IS a chat library, even if the contract is agent-general.

## Migration mechanics

Mechanical rename. Proceed in this order:

1. Rename files (via `git mv`) — preserves history.
2. Update type/function names inside each file (find/replace).
3. Update `agent/index.ts` and `public-api.ts` exports.
4. Update all consumer imports.
5. Lint/test/build to catch stragglers.

No backwards-compat shims, so a missed import surfaces immediately as a build error.

## Risk

- **Large blast radius:** ~69 files. Mitigated by mechanical nature (find/replace) and strict build-break signal (no compat shims).
- **Symbol collisions accepted:** we've chosen `Agent*` prefixes for types that would collide with DOM globals (`CustomEvent`) or transitive deps (`@langchain/langgraph-sdk`'s `Interrupt`, `Checkpoint`).
- **Cockpit demo churn:** Phase-1 already updated cockpit apps to use `toChatAgent` / `mockChatAgent` / `ChatAgent` types. This rename re-churns those same ~25 files. One-liners per file.

## When to revisit

- If a non-chat UI library is added that consumes the same contract (e.g., a `@cacheplane/task` or `@cacheplane/review` package), the `Agent*`-prefixed submit types feel correct and no re-rename needed.
- If the `ChatAgent extends Agent` subclass pattern becomes wanted (e.g., to add chat-specific fields like typing status or read receipts), revisit this design and reintroduce the subclass.
