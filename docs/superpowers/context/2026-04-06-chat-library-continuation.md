# Chat Library & Cockpit Integration — Continuation Context

**Date:** 2026-04-06
**Purpose:** Handoff prompt for continuing work on @cacheplane/render, @cacheplane/chat, and cockpit integration.

---

## What Was Built

### @cacheplane/render (`libs/render`) — Angular Renderer for @json-render/core

An Angular rendering layer that takes flat JSON specs and recursively renders them as Angular components.

**Key exports:**
- `defineAngularRegistry(componentMap)` — maps json-render catalog names to Angular components
- `RenderSpecComponent` (`<render-spec>`) — top-level entry, accepts `[spec]`, `[registry]`, `[store]`, `[loading]`
- `RenderElementComponent` (`<render-element>`) — recursive renderer using `NgComponentOutlet` + `ngTemplateOutlet`
- `signalStateStore(initialState)` — Signal-backed StateStore for @json-render/core (JSON Pointer paths)
- `provideRender(config)` — DI provider

**Architecture:** Spec → root lookup → component resolution from registry → visibility check → prop resolution via `@json-render/core`'s `resolveElementProps()` → binding resolution → `NgComponentOutlet` → recursive child rendering via `childKeys`. Uses `viewProviders` for `RENDER_CONTEXT` scoping.

**Tests:** 37 passing. Logic-level tests (no Angular template compiler in Vitest).

**Peer deps:** `@json-render/core` (^0.16.0), `@angular/core`, `@angular/common`

### @cacheplane/chat (`libs/chat`) — Chat UI Component Library

Two-layer Angular chat library: headless primitives + prebuilt Tailwind compositions (shadcn model).

**Headless primitives (10):**
- `ChatMessagesComponent` (`<chat-messages>`) + `MessageTemplateDirective` (`chatMessageTemplate`)
- `ChatInputComponent` (`<chat-input>`) — pill-shaped, sends `{role: 'human', content: text}` (NOT HumanMessage objects — SDK serialization issue)
- `ChatTypingIndicatorComponent` (`<chat-typing-indicator>`) — 3-dot pulse animation with avatar
- `ChatErrorComponent` (`<chat-error>`) — themed error banner
- `ChatInterruptComponent` (`<chat-interrupt>`) — content-projected interrupt template
- `ChatToolCallsComponent` (`<chat-tool-calls>`) — per-message or global tool calls
- `ChatSubagentsComponent` (`<chat-subagents>`) — active subagent iteration
- `ChatThreadListComponent` (`<chat-thread-list>`) — thread sidebar
- `ChatTimelineComponent` (`<chat-timeline>`) — checkpoint history
- `ChatGenerativeUiComponent` (`<chat-generative-ui>`) — wraps `<render-spec>`

**Prebuilt compositions (7):**
- `ChatComponent` (`<chat>`) — full chat layout with Apple-clean aesthetic
- `ChatDebugComponent` (`<chat-debug>`) — chat + debug panel (timeline, state inspector, diff)
- `ChatInterruptPanelComponent` — accept/edit/respond/ignore actions
- `ChatToolCallCardComponent` — collapsible tool call detail
- `ChatSubagentCardComponent` — status badge + message stream
- `ChatTimelineSliderComponent` — checkpoint navigator with replay/fork outputs

**Design system:**
- 40+ CSS custom properties (`--chat-bg`, `--chat-text`, `--chat-border`, etc.)
- Dark mode default, light via `prefers-color-scheme` or `data-chat-theme="light"`
- Neutral gray palette — no brand colors in defaults
- AI messages: no bubble, plain text with avatar badge (ChatGPT pattern)
- Human messages: subtle surface bubble with asymmetric border-radius
- Pill-shaped input with circular send button
- 720px centered content column, responsive

**Tests:** 112 passing.

**Peer deps:** `@cacheplane/render`, `@cacheplane/angular`, `@angular/core`, `@angular/common`, `@langchain/core`

### Cockpit Integration — 14 Angular Examples

All 14 standalone Angular apps consuming @cacheplane/chat, each with Angular CLI build/serve targets.

| Example | Component | Capability Feature |
|---|---|---|
| streaming | `<chat>` | Basic streaming |
| persistence | `<chat>` + `[threads]` | Thread management via `switchThread()` |
| interrupts | `<chat>` + interrupt panel | `ChatInterruptPanelComponent` with resume |
| memory (LG) | `<chat>` + facts sidebar | `stream.value().memory` entries |
| time-travel | `<chat>` + timeline slider | `ChatTimelineSliderComponent` with replay/fork |
| subgraphs | `<chat>` + subagent sidebar | `stream.subagents()` Map entries |
| durable-execution | `<chat>` + step pipeline | analyze→plan→generate progress + retry |
| deployment-runtime | `<chat>` | Production config |
| planning | `<chat-debug>` + plan sidebar | Step progress ✓/○ |
| filesystem | `<chat-debug>` + ops sidebar | File read/write log |
| subagents (DA) | `<chat-debug>` + delegation sidebar | Tool call tracking |
| memory (DA) | `<chat-debug>` + facts sidebar | `agent_memory` display |
| skills | `<chat-debug>` + skills sidebar | Calculator/word_count/summarize |
| sandboxes | `<chat-debug>` + exec sidebar | Code execution logs |

**Ports:** streaming=4300, persistence=4301, interrupts=4302, memory=4303, durable-execution=4304, subgraphs=4305, time-travel=4306, deployment-runtime=4307, planning=4310, filesystem=4311, subagents=4312, memory(DA)=4313, skills=4314, sandboxes=4315

**Serve all:** `npx tsx apps/cockpit/scripts/serve-example.ts --all`
**Serve one:** `npx tsx apps/cockpit/scripts/serve-example.ts --capability=streaming`

---

## Critical Issues Found & Fixed

1. **HumanMessage serialization** — `new HumanMessage(text)` gets serialized by the LangGraph SDK as `{lc: 1, type: 'constructor', ...}` which the Python backend rejects. Fixed: send `{role: 'human', content: text}` instead.

2. **`fileReplacements` missing** — PR #19 rewrote all `project.json` files and stripped `fileReplacements` from development configs, causing the production environment (LangGraph Cloud URLs with auth) to be used instead of the dev environment (local proxy). Fixed in all 14 examples.

3. **Style interpolation bugs** — `style="{{ expr }}"` doesn't work in Angular templates. Must use `[style.property]="expr"`. Fixed in ChatInput, planning, sandboxes components.

4. **PR #19 reverted streaming + deployment-runtime** — Back to `LegacyChatComponent` / `<cp-chat>`. Restored to `ChatComponent` / `<chat>`.

5. **Python backend needs OPENAI_API_KEY** — The `.env` file must be in each Python example's directory. Symlinked from root `.env`.

---

## Current State (What's Working, What's Not)

### Working:
- All 14 examples build (`nx run-many -t build --projects='cockpit-*-angular'`)
- All library tests pass (37 render + 112 chat)
- Backend API works (tested via curl: thread creation, streaming, responses)
- Proxy works (Angular dev server → Python backend via `/api`)

### NOT Working (needs debugging):
- **Runtime errors in browser** — The streaming example loads but has console errors when used in the cockpit. The exact errors need to be captured from the browser console. The curl-based E2E test works (backend responds correctly), so the issue is in the Angular runtime — likely component initialization, signal wiring, or template rendering.
- **Chrome extension for debugging** — Was not connecting during this session. Need to use Playwright MCP or Chrome DevTools directly to capture console errors.

### Next Immediate Step:
**Capture the browser console errors** and fix them. The E2E flow works at the API level — the problem is between the Angular component and the browser.

---

## Key Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Message wire format | `{role, content}` dict (NOT HumanMessage) | SDK serializes LangChain objects in constructor format, backend rejects |
| Chat selector | `chat` (not `chat-ui`) | Simple, memorable |
| AI message style | No bubble, plain text + avatar | ChatGPT pattern |
| Theming | CSS custom properties on `:host` | No runtime overhead, works with any CSS framework |
| Template overrides | `chatMessageTemplate` directive | Full rendering control per message type |
| State ownership | Consumer passes AgentRef | Chat components never create it internally |
| Rendering | ngTemplateOutlet recursion | Proven pattern from hashbrown |

---

## File Locations

```
libs/render/                          # @cacheplane/render
libs/chat/                            # @cacheplane/chat
libs/chat/src/lib/styles/chat-theme.css  # CSS custom properties
libs/angular/                 # @cacheplane/angular (existing)
cockpit/langgraph/*/angular/          # 8 LangGraph examples
cockpit/deep-agents/*/angular/        # 6 Deep Agents examples
apps/cockpit/                         # Next.js cockpit shell
apps/cockpit/scripts/serve-example.ts # Serve script
apps/cockpit/scripts/capability-registry.ts  # Port/project registry
docs/superpowers/specs/               # Design specs
docs/superpowers/plans/               # Implementation plans
```

## Environment Setup

```bash
# Source nvm
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# uv for Python (needed for langgraph dev)
export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"

# Symlink .env for Python backends
ln -sf ../../../../.env cockpit/langgraph/streaming/python/.env

# Run streaming example with backend
npx tsx apps/cockpit/scripts/serve-example.ts --capability=streaming
# → cockpit on 4201, angular on 4300, python on 8123

# Run all
npx tsx apps/cockpit/scripts/serve-example.ts --all

# Test
npx nx test render && npx nx test chat && npx nx test angular

# Build all examples
npx nx run-many -t build --projects='cockpit-*-angular'
```

---

## What's Next (Priority Order)

1. **Fix runtime errors** — Capture browser console errors from http://localhost:4300, debug and fix. The API layer works; the issue is Angular runtime.
2. **E2E tests** — Write Playwright or Cypress tests verifying full streaming turns work.
3. **Update cockpit manifest** — Register Angular examples in `libs/cockpit-registry/src/lib/manifest.ts`.
4. **npm publish** — Publish `@cacheplane/render` and `@cacheplane/chat`.
5. **Markdown rendering** — Add markdown support to AI message templates.
6. **ChatDebug Tier 2** — Token/cost tracking, latency waterfall, time-travel navigation.
