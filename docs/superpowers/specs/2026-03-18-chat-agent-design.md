# Chat Agent Example — Design Specification

**Date:** 2026-03-18
**Status:** Approved
**Location:** `examples/chat-agent/` in the `angular` monorepo

---

## Overview

A minimal Python LangGraph chat agent that serves as the reference backend for the `angular` Angular library. It demonstrates every currently-implemented `agent()` feature: token-by-token message streaming, thread persistence across page refreshes, and LangSmith tracing.

The example is self-contained inside the monorepo and supports two modes: local development via `langgraph dev` and cloud deployment via `langgraph deploy` to LangSmith-managed infrastructure.

---

## 1. Goals

- Provide a runnable Python backend that the Angular library's `FetchStreamTransport` can connect to out of the box
- Demonstrate streaming, thread persistence (`MemorySaver` + `threadId`), and configurable system prompt
- Serve as the target server for `e2e/angular-e2e/` Playwright integration tests
- Serve as the backend for the website's live Angular Elements demo

---

## 2. File Structure

```
examples/chat-agent/
├── pyproject.toml          # uv project: python 3.12, langgraph, langchain-openai
├── langgraph.json          # LangGraph CLI manifest — graph_id: chat_agent
├── .env.example            # OPENAI_API_KEY, OPENAI_MODEL, LANGSMITH_API_KEY, LANGSMITH_PROJECT, LANGSMITH_TRACING
├── .gitignore              # .env, .langgraph_api, __pycache__, .venv
├── tests/
│   └── test_agent.py       # 2 pytest integration tests
└── src/
    └── chat_agent/
        ├── __init__.py
        ├── agent.py        # StateGraph definition, exported as `graph`
        └── config.py       # RunnableConfig TypedDict with system_prompt field
```

---

## 3. Agent Design

**Framework:** LangGraph (`langgraph>=0.3`)

**State:** `MessagesState` — built-in LangGraph state schema that holds a list of `BaseMessage` objects with append-only reducer semantics.

**Graph:** Single node (`call_model`) connected in sequence:

```
START → call_model → END
```

**`call_model` node:**
- Reads `system_prompt` from `config["configurable"]`, defaulting to `"You are a helpful assistant."`
- Reads model name from `os.environ.get("OPENAI_MODEL", "gpt-5-mini")`
- Prepends a `SystemMessage` to the incoming messages
- Calls `ChatOpenAI(model=model_name)` — LangGraph's SSE transport handles streaming at the server level; no `streaming=True` needed on the model
- Returns `{"messages": [ai_message]}`

**Checkpointer:** `MemorySaver` — in-process memory store. Threads persist for the lifetime of the server process. Sufficient for local dev and e2e tests; swap for `AsyncPostgresSaver` for production persistence.

**Export:** The compiled graph is exported as the module-level name `graph`. `langgraph.json` references it as `chat_agent.agent:graph`.

---

## 4. Configuration

**`config.py`** defines a `TypedDict`:

```python
class Configuration(TypedDict):
    system_prompt: str  # default: "You are a helpful assistant."
```

Passed via `RunnableConfig["configurable"]`. The Angular client can set this per-thread:

```typescript
agent({
  assistantId: 'chat_agent',
  config: { configurable: { system_prompt: 'You are a coding assistant.' } },
})
```

---

## 5. Angular Integration

The Angular app connects via `provideAgent` and `agent()`:

```typescript
// app.config.ts
provideAgent({ apiUrl: 'http://localhost:2024' })

// chat.component.ts
const chat = agent<{ messages: BaseMessage[] }>({
  // Local dev: use graph_id string ('chat_agent')
  // LangSmith cloud: use the assistant UUID from the LangSmith console
  assistantId: environment.assistantId,
  threadId: signal(this.activeThreadId),
  onThreadId: (id) => {
    this.activeThreadId = id;
    localStorage.setItem('threadId', id);  // persist across page refreshes
  },
});
```

- **Local dev:** `assistantId` is the `graph_id` string from `langgraph.json` (e.g., `'chat_agent'`)
- **LangSmith cloud:** `assistantId` is the UUID assigned by LangSmith when the assistant is created via `langgraph deploy`. Retrieve it from the LangSmith console or the Assistants API
- `threadId: signal<string | null>(null)` creates a new thread on first submit; a stored string resumes an existing thread
- `onThreadId` fires on the first `metadata` SSE event — store the returned ID to resume the thread after page refresh
- Token-by-token streaming updates `chat.messages()` — Angular re-renders on each chunk

---

## 6. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `OPENAI_MODEL` | No | Model name (default: `gpt-5-mini`). Change to `gpt-4o-mini` if `gpt-5-mini` is unavailable in your account |
| `LANGSMITH_API_KEY` | Deploy only | Required for `langgraph deploy`. Not needed for local `langgraph dev` |
| `LANGSMITH_TRACING` | No | Set to `true` to enable LangSmith trace logging during local dev |
| `LANGSMITH_PROJECT` | No | Project name in LangSmith UI (default: `angular-example`) |

---

## 7. Local Development

```bash
cd examples/chat-agent
uv sync                    # creates .venv and installs dependencies
cp .env.example .env       # populate OPENAI_API_KEY at minimum
langgraph dev              # starts API server at http://localhost:2024 with hot reload
```

The LangGraph dev server exposes a REST + SSE API at `http://localhost:2024`. The LangGraph Studio desktop app can connect to this address to inspect thread state and traces visually.

---

## 8. Deployment

```bash
langgraph build            # packages agent into Docker image
langgraph deploy           # pushes to LangSmith cloud infrastructure
```

After deployment, the CLI prints a URL (e.g., `https://<org>.langsmith.com/api/v1/...`) and an assistant UUID. Use the UUID as `assistantId` in the Angular app for production.

The deployed URL is used in:
- Angular demo app environment config (`environment.prod.ts`)
- Next.js website environment (`NEXT_PUBLIC_LANGGRAPH_URL`)
- Playwright e2e config for CI against the live deployment

---

## 9. Testing

Two pytest integration tests in `tests/test_agent.py`:

1. **`test_single_turn`** — invokes graph directly with a single `HumanMessage`, asserts a non-empty `AIMessage` is returned. Verifies graph compilation and LLM connectivity.

2. **`test_thread_persistence`** — submits two messages on the same `thread_id` via `MemorySaver`, asserts the second response demonstrates awareness of the first. Verifies thread checkpointing.

Tests require `OPENAI_API_KEY` and are skipped in CI when not present (`pytest.mark.skipif`). Streaming behavior is covered by `e2e/angular-e2e/` Playwright tests.

---

## 10. Dependencies

```toml
[project]
name = "chat-agent"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "langgraph>=0.3",
    "langchain-openai>=0.3",
    "langsmith>=0.2",
    "python-dotenv>=1.0",
]
```

---

## 11. `langgraph.json`

```json
{
  "dependencies": ["."],
  "graphs": {
    "chat_agent": "./src/chat_agent/agent.py:graph"
  },
  "env": ".env",
  "python_version": "3.12"
}
```

- `graph_id` is `chat_agent` — used as `assistantId` in local dev
- `python_version` ensures `langgraph build` uses Python 3.12, matching `pyproject.toml`
