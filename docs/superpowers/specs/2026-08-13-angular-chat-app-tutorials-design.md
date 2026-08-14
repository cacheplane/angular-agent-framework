# Angular Chat App Tutorials (AG-UI + LangChain/LangGraph) — Design

Date: 2026-08-13
Status: approved

## Goal

Two net-new blog posts under `apps/website/content/blog/`, in Brian's voice, that
build a chat **app** rather than a chat surface. They sit alongside the existing
May posts rather than replacing them.

## Relationship to existing posts

| Existing post | Scope |
|---|---|
| `2026-05-17-build-a-streaming-chat-ui-in-angular-with-langgraph` | Wires a single `<chat>` to LangGraph |
| `2026-05-21-build-fullstack-agentic-angular-apps-using-ag-ui` | AG-UI event model → Angular signals |

The new posts assume that ground is covered and cross-link to it. They do not
re-explain the protocol event model or the streaming rationale.

## The two posts are deliberately differentiated

Server-backed thread history is a LangGraph capability: `LangGraphThreadsAdapter`
wraps `client.threads.*`, and `injectThreadRouting({ validate })` needs a
thread-lookup endpoint. AG-UI is event-stream-only and defines no such endpoint.

Rather than paper over that, each post gets its own spine:

- **LangGraph post** — the multi-thread app: sidebar, history, routing, persistence.
- **AG-UI post** — the portable app: client tools, shared state, backend swap.

Each post names the other's strength and links to it.

## Post 1 — `Angular Chat App Tutorial with LangChain and LangGraph`

File: `apps/website/content/blog/2026-08-13-angular-chat-app-tutorial-with-langchain-langgraph.mdx`

1. Lede + `## Goals`
2. What are we building? — architecture as a text block
3. Getting a LangGraph server running — minimal `graph.py` (`MessagesState`,
   `ChatOpenAI`, `MemorySaver`), `langgraph.json`, `langgraph dev`
4. Wiring Angular — `provideAgent({ apiUrl, assistantId })`, `<chat [agent]>`
5. One conversation → an app — module-scope `ACTIVE_THREAD` signal,
   `threadId`/`onThreadId`, `<chat-sidenav>`, `LangGraphThreadsAdapter`,
   `ThreadActionAdapter`, `refreshOnRunEnd`
6. Surviving a refresh — `injectThreadRouting({ threadId, validate })`;
   URL is the sole source of truth, nothing in localStorage
7. Where thread titles come from — a terminal node writing `metadata.title`,
   `titleFallback`
8. Before production — `MemorySaver` makes bookmarkable URLs lie; thread
   ownership; keys behind a BFF; CORS; `retry()`
9. `## Conclusion`

## Post 2 — `Angular Chat App Tutorial with AG-UI`

File: `apps/website/content/blog/2026-08-13-angular-chat-app-tutorial-with-ag-ui.mdx`

1. Lede + `## Goals`
2. What are we building?
3. Getting an AG-UI endpoint running — FastAPI + an official integration; note
   that CrewAI / Mastra / Pydantic AI / Strands expose the same shape
4. Wiring Angular — `provideAgent({ url })`, `<chat [agent]>`
5. Giving the browser its own tools — `tools()`/`action()`/`view()`/`ask()`,
   `[clientTools]`, `ViewProps<typeof schema>`, `followUp: false`
6. Sharing state — `agent.state()`, `agent.customEvents()`
7. Swapping the backend — one-line `provideAgent` change; event-mapping checklist
8. What AG-UI doesn't give you — no thread-lookup, so no `validate`; thread
   history is app-owned. Links to Post 1
9. Before production — auth headers, proxy buffering, CORS, thread ownership
10. `## Conclusion`

## Constraints

- Voice: the register of the 2026-08-09 Strands post — H2-as-question, `## Goals`,
  "Let's" transitions, explicit `## Conclusion`, tradeoffs named, contractions.
  No invented first-person anecdotes.
- Frontmatter: `author: brian`, `draft: false`, `featured: false`, dated 2026-08-13.
- `@threadplane/*` at 0.0.57. Angular 20/21, Node 22.
- MDX components available to blog posts (same renderer as docs): `Callout`,
  `Steps`/`Step`, `Tabs`/`Tab`, `Card`/`CardGroup`, `CodeGroup`.
- Licensing callout for `@threadplane/chat`, matching the Strands post.

## Verification

Every snippet must come from code that actually ran. Both backends and both
Angular apps are scaffolded in the scratchpad against the **published** npm
packages, built, and driven in a browser before the posts are written.
