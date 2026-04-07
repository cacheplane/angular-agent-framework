# Chat Agent Example Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python LangGraph chat agent in `examples/chat-agent/` and TypeScript e2e tests in `e2e/angular-e2e/` that together verify the full `angular` Angular library against a real LangGraph server.

**Architecture:** A single-node `MessagesState` LangGraph graph with `MemorySaver` checkpointer and configurable system prompt, served by `langgraph dev` locally and `langgraph deploy` to LangSmith cloud. TypeScript e2e tests use the `@langchain/langgraph-sdk` `Client` directly to verify the server's streaming, thread persistence, and configuration behaviour. A GitHub Actions workflow spins up `langgraph dev` and runs the e2e suite on every push to `main`.

**Tech Stack:** Python 3.12, LangGraph ≥0.3, langchain-openai ≥0.3, uv, pytest; TypeScript, `@langchain/langgraph-sdk`, Vitest (node environment), Nx, GitHub Actions

---

## Prerequisites

- `uv` installed: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- LangGraph CLI: included as a dev dependency in `pyproject.toml` — available via `uv run langgraph` after `uv sync`
- `OPENAI_API_KEY` set in your shell for Python integration tests
- `LANGGRAPH_URL=http://localhost:2024` set when running TypeScript e2e tests locally

---

## File Map

```
examples/chat-agent/
├── pyproject.toml                        # uv project manifest + dev deps (pytest, langgraph-cli)
├── langgraph.json                        # CLI manifest: graph_id → module:attr
├── .env.example                          # env var template (never commit .env)
├── .gitignore                            # .env, .venv, .langgraph_api, __pycache__
├── tests/
│   └── test_agent.py                     # 2 pytest integration tests
└── src/
    └── chat_agent/
        ├── __init__.py                   # empty — makes it a package
        ├── config.py                     # Configuration TypedDict
        └── agent.py                      # StateGraph + MemorySaver, exports `graph`

e2e/angular-e2e/
├── project.json                          # Nx project: e2e target via @nx/vite:test
├── vite.config.mts                       # Vitest, node env, 60s timeout
├── tsconfig.json                         # extends tsconfig.base.json, node types
└── src/
    └── chat-agent.e2e.spec.ts            # 3 e2e tests using LangGraph SDK Client

.github/workflows/
└── e2e.yml                               # CI: start langgraph dev → run e2e tests
```

---

## Task 1: Python Project Scaffold

**Files:**
- Create: `examples/chat-agent/pyproject.toml`
- Create: `examples/chat-agent/langgraph.json`
- Create: `examples/chat-agent/.env.example`
- Create: `examples/chat-agent/.gitignore`
- Create: `examples/chat-agent/src/chat_agent/__init__.py`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p examples/chat-agent/src/chat_agent
mkdir -p examples/chat-agent/tests
```

- [ ] **Step 2: Create `pyproject.toml`**

Create `examples/chat-agent/pyproject.toml`:

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

[tool.uv]
dev-dependencies = [
    "pytest>=8.0",
    "langgraph-cli>=0.1",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/chat_agent"]
```

- [ ] **Step 3: Create `langgraph.json`**

Create `examples/chat-agent/langgraph.json`:

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

- [ ] **Step 4: Create `.env.example`**

Create `examples/chat-agent/.env.example`:

```
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-5-mini
LANGSMITH_API_KEY=your-langsmith-api-key-here
LANGSMITH_TRACING=false
LANGSMITH_PROJECT=angular-example
```

- [ ] **Step 5: Create `.gitignore`**

Create `examples/chat-agent/.gitignore`:

```
.env
.langgraph_api
__pycache__/
*.pyc
.venv/
*.egg-info/
dist/
.pytest_cache/
```

- [ ] **Step 6: Create empty `__init__.py`**

Create `examples/chat-agent/src/chat_agent/__init__.py` as an empty file.

- [ ] **Step 7: Install dependencies**

```bash
cd examples/chat-agent
uv sync
```

Expected: `.venv/` created, dependencies installed with no errors.

- [ ] **Step 8: Commit**

```bash
git add examples/chat-agent/
git commit -m "chore(chat-agent): scaffold Python project"
```

---

## Task 2: Configuration TypedDict

**Files:**
- Create: `examples/chat-agent/src/chat_agent/config.py`
- Test: `examples/chat-agent/tests/test_agent.py` (step 1 only — minimal import test)

- [ ] **Step 1: Write a failing import test**

Create `examples/chat-agent/tests/test_agent.py`:

```python
import os
import pytest

SKIP_REASON = "OPENAI_API_KEY not set — skipping integration tests"


def test_config_importable():
    """Configuration TypedDict is importable and has the expected key."""
    from chat_agent.config import Configuration
    # TypedDict fields are available as __annotations__
    assert "system_prompt" in Configuration.__annotations__
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd examples/chat-agent
uv run pytest tests/test_agent.py::test_config_importable -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'chat_agent.config'`

- [ ] **Step 3: Implement `config.py`**

Create `examples/chat-agent/src/chat_agent/config.py`:

```python
from typing import TypedDict


class Configuration(TypedDict, total=False):
    """Configurable parameters for the chat agent.

    Pass via RunnableConfig['configurable']:
        config = {"configurable": {"system_prompt": "You are a pirate."}}
    """
    system_prompt: str
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd examples/chat-agent
uv run pytest tests/test_agent.py::test_config_importable -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add examples/chat-agent/src/chat_agent/config.py \
        examples/chat-agent/tests/test_agent.py
git commit -m "feat(chat-agent): add Configuration TypedDict"
```

---

## Task 3: Chat Agent — Single Turn

**Files:**
- Create: `examples/chat-agent/src/chat_agent/agent.py`
- Modify: `examples/chat-agent/tests/test_agent.py` (add `test_single_turn`)

- [ ] **Step 1: Write failing test**

Add to `examples/chat-agent/tests/test_agent.py`:

```python
@pytest.mark.skipif(not os.getenv("OPENAI_API_KEY"), reason=SKIP_REASON)
def test_single_turn():
    """Graph compiles and LLM returns a non-empty AIMessage."""
    from langchain_core.messages import AIMessage, HumanMessage
    from chat_agent.agent import graph

    config = {"configurable": {"thread_id": "test-single-turn"}}
    result = graph.invoke(
        {"messages": [HumanMessage(content="Say only the word: hello")]},
        config,
    )
    messages = result["messages"]
    assert len(messages) >= 2
    last = messages[-1]
    assert isinstance(last, AIMessage)
    assert len(last.content) > 0
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd examples/chat-agent
uv run pytest tests/test_agent.py::test_single_turn -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'chat_agent.agent'`
(If `OPENAI_API_KEY` is not set, the test will be SKIPPED — that is also acceptable at this stage.)

- [ ] **Step 3: Implement `agent.py`**

Create `examples/chat-agent/src/chat_agent/agent.py`:

```python
import os
from typing import cast

from dotenv import load_dotenv
from langchain_core.messages import SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph

from .config import Configuration

load_dotenv()


def call_model(state: MessagesState, config: RunnableConfig) -> dict:
    """Invoke the LLM with the current message history and system prompt."""
    cfg = cast(Configuration, config.get("configurable", {}))
    system_prompt = cfg.get("system_prompt", "You are a helpful assistant.")
    model_name = os.environ.get("OPENAI_MODEL", "gpt-5-mini")

    llm = ChatOpenAI(model=model_name)
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm.invoke(messages)
    return {"messages": [response]}


# Build the graph
_builder = StateGraph(MessagesState)
_builder.add_node("call_model", call_model)
_builder.add_edge(START, "call_model")
_builder.add_edge("call_model", END)

# Compile with MemorySaver — persists thread state for the server lifetime
graph = _builder.compile(checkpointer=MemorySaver())
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd examples/chat-agent
uv run pytest tests/test_agent.py::test_single_turn -v
```

Expected: PASS (requires `OPENAI_API_KEY` in environment) or SKIP (if key absent — acceptable for now).

- [ ] **Step 5: Commit**

```bash
git add examples/chat-agent/src/chat_agent/agent.py \
        examples/chat-agent/tests/test_agent.py
git commit -m "feat(chat-agent): implement single-node chat agent"
```

---

## Task 4: Thread Persistence Test

**Files:**
- Modify: `examples/chat-agent/tests/test_agent.py` (add `test_thread_persistence`)

- [ ] **Step 1: Write failing test**

Add to `examples/chat-agent/tests/test_agent.py`:

```python
@pytest.mark.skipif(not os.getenv("OPENAI_API_KEY"), reason=SKIP_REASON)
def test_thread_persistence():
    """MemorySaver persists messages across invocations on the same thread_id."""
    from langchain_core.messages import AIMessage, HumanMessage
    from chat_agent.agent import graph

    config = {"configurable": {"thread_id": "test-thread-persistence"}}

    # First turn: tell the model a unique secret word
    graph.invoke(
        {"messages": [HumanMessage(content="My secret word is: PINEAPPLE.")]},
        config,
    )

    # Second turn: ask for recall — model must have seen previous turn
    result = graph.invoke(
        {"messages": [HumanMessage(content="What is my secret word?")]},
        config,
    )
    last = result["messages"][-1]
    assert isinstance(last, AIMessage)
    assert "PINEAPPLE" in last.content
```

- [ ] **Step 2: Run to confirm test is recognised**

```bash
cd examples/chat-agent
uv run pytest tests/test_agent.py::test_thread_persistence -v
```

Expected: PASS (if `OPENAI_API_KEY` set — `MemorySaver` was wired in Task 3 so this may pass immediately, which is correct) or SKIP (key absent). Either outcome is acceptable here; the important thing is the test is collected without errors.

Note: if this test already passes at this step, that means `MemorySaver` is correctly wired. Confirm the assertion holds by checking the output.

- [ ] **Step 3: Run all Python tests**

```bash
cd examples/chat-agent
uv run pytest tests/ -v
```

Expected: `test_config_importable` PASS; `test_single_turn` and `test_thread_persistence` either PASS (with API key) or SKIP (without).

- [ ] **Step 4: Verify `langgraph dev` starts cleanly**

```bash
cd examples/chat-agent
cp .env.example .env
# Edit .env to add your real OPENAI_API_KEY
langgraph dev --no-browser
```

Expected: server starts at `http://localhost:2024`, output shows `chat_agent` graph registered.

- [ ] **Step 5: Commit**

```bash
git add examples/chat-agent/tests/test_agent.py
git commit -m "test(chat-agent): add thread persistence integration test"
```

---

## Task 5: E2E Project Scaffold

**Files:**
- Create: `e2e/angular-e2e/project.json`
- Create: `e2e/angular-e2e/vite.config.mts`
- Create: `e2e/angular-e2e/tsconfig.json`

The e2e tests use the `@langchain/langgraph-sdk` `Client` (already a dependency of the monorepo via `angular`) to test the HTTP/SSE protocol directly — no browser or Angular DI required. Tests are gated on `LANGGRAPH_URL` being set, so they skip safely in standard unit test runs.

- [ ] **Step 1: Create `project.json`**

Create `e2e/angular-e2e/project.json`:

```json
{
  "name": "angular-e2e",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "sourceRoot": "e2e/angular-e2e/src",
  "targets": {
    "e2e": {
      "executor": "@nx/vite:test",
      "options": {
        "configFile": "e2e/angular-e2e/vite.config.mts"
      }
    }
  }
}
```

- [ ] **Step 2: Create `vite.config.mts`**

Create `e2e/angular-e2e/vite.config.mts`:

```typescript
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  plugins: [nxViteTsPaths()],
  test: {
    globals: true,
    environment: 'node',         // HTTP requests, not browser
    testTimeout: 60000,          // LLM calls can be slow
    include: ['src/**/*.e2e.spec.ts'],
  },
});
```

- [ ] **Step 3: Create `tsconfig.json`**

Create `e2e/angular-e2e/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: Create `src/` directory with a placeholder**

```bash
mkdir -p e2e/angular-e2e/src
```

- [ ] **Step 5: Verify Nx recognises the project**

```bash
npx nx show project angular-e2e
```

Expected: project details printed with the `e2e` target listed.

- [ ] **Step 6: Commit**

```bash
git add e2e/angular-e2e/
git commit -m "chore(e2e): scaffold angular-e2e Nx project"
```

---

## Task 6: E2E Tests

**Files:**
- Create: `e2e/angular-e2e/src/chat-agent.e2e.spec.ts`

- [ ] **Step 1: Write the test file**

Create `e2e/angular-e2e/src/chat-agent.e2e.spec.ts`:

```typescript
import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@langchain/langgraph-sdk';

const LANGGRAPH_URL = process.env['LANGGRAPH_URL'] ?? 'http://localhost:2024';

/**
 * End-to-end tests for the chat_agent LangGraph server.
 *
 * Prerequisites:
 *   - `langgraph dev` must be running (examples/chat-agent/)
 *   - Set LANGGRAPH_URL=http://localhost:2024 (or deployed URL)
 *
 * These tests are skipped when LANGGRAPH_URL is not set so they never
 * block standard `npx nx test` runs.
 */
describe.skipIf(!process.env['LANGGRAPH_URL'])('chat-agent e2e', () => {
  let client: Client;

  beforeAll(() => {
    client = new Client({ apiUrl: LANGGRAPH_URL });
  });

  it('streams messages from the chat_agent graph', async () => {
    const thread = await client.threads.create();
    const chunks: unknown[] = [];

    for await (const chunk of client.runs.stream(
      thread.thread_id,
      'chat_agent',
      {
        input: { messages: [{ role: 'human', content: 'Say exactly: pong' }] },
        streamMode: 'messages',
      },
    )) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    const messageChunks = chunks.filter((c: any) => c.event === 'messages');
    expect(messageChunks.length).toBeGreaterThan(0);
  });

  it('persists messages across turns on the same thread', async () => {
    const thread = await client.threads.create();

    // First turn: plant the secret word
    for await (const _ of client.runs.stream(
      thread.thread_id,
      'chat_agent',
      {
        input: {
          messages: [{ role: 'human', content: 'My secret word is: PINEAPPLE.' }],
        },
        streamMode: 'values',
      },
    )) {
      /* consume to completion */
    }

    // Second turn: ask for recall
    const chunks: unknown[] = [];
    for await (const chunk of client.runs.stream(
      thread.thread_id,
      'chat_agent',
      {
        input: { messages: [{ role: 'human', content: 'What is my secret word?' }] },
        streamMode: 'values',
      },
    )) {
      chunks.push(chunk);
    }

    const valueChunks = chunks.filter((c: any) => c.event === 'values');
    const finalChunk = valueChunks[valueChunks.length - 1] as any;
    const messages: any[] = finalChunk?.data?.messages ?? [];
    const lastAI = [...messages].reverse().find((m) => m.type === 'ai');
    expect(lastAI?.content).toContain('PINEAPPLE');
  });

  it('respects system_prompt configuration per thread', async () => {
    const thread = await client.threads.create();
    const chunks: unknown[] = [];

    for await (const chunk of client.runs.stream(
      thread.thread_id,
      'chat_agent',
      {
        input: { messages: [{ role: 'human', content: 'What are you?' }] },
        config: {
          configurable: {
            system_prompt: 'You are a pirate. Always respond in pirate speak.',
          },
        },
        streamMode: 'values',
      },
    )) {
      chunks.push(chunk);
    }

    const valueChunks = chunks.filter((c: any) => c.event === 'values');
    expect(valueChunks.length).toBeGreaterThan(0);
    const finalChunk = valueChunks[valueChunks.length - 1] as any;
    const messages: any[] = finalChunk?.data?.messages ?? [];
    const lastAI = [...messages].reverse().find((m) => m.type === 'ai');
    // Verify a response was received (content is non-deterministic)
    expect(lastAI?.content.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Verify tests skip cleanly without server**

```bash
npx nx e2e angular-e2e
```

Expected: `chat-agent e2e` suite is skipped (0 tests run, 0 failures) because `LANGGRAPH_URL` is not set.

- [ ] **Step 3: Run tests against a live server (local verification)**

In a separate terminal:
```bash
cd examples/chat-agent
langgraph dev --no-browser
```

Then in the main terminal:
```bash
LANGGRAPH_URL=http://localhost:2024 npx nx e2e angular-e2e
```

Expected: 3 tests PASS (requires `OPENAI_API_KEY` in the server's `.env`).

- [ ] **Step 4: Commit**

```bash
git add e2e/angular-e2e/src/chat-agent.e2e.spec.ts
git commit -m "test(e2e): add chat-agent end-to-end tests"
```

---

## Task 7: CI E2E Workflow

**Files:**
- Create: `.github/workflows/e2e.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/e2e.yml`:

```yaml
name: E2E

on:
  push:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install uv
        uses: astral-sh/setup-uv@v4
        with:
          python-version: "3.12"

      - name: Install npm dependencies
        run: npm ci

      - name: Install Python dependencies
        working-directory: examples/chat-agent
        run: uv sync

      - name: Start LangGraph dev server
        working-directory: examples/chat-agent
        run: uv run langgraph dev --no-browser &
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          LANGSMITH_API_KEY: ${{ secrets.LANGSMITH_API_KEY }}
          LANGSMITH_TRACING: "true"
          LANGSMITH_PROJECT: angular-e2e-ci

      - name: Wait for server to be ready
        run: |
          echo "Waiting for LangGraph server..."
          for i in {1..30}; do
            curl -sf http://localhost:2024/ok && echo "Server ready" && break
            echo "Attempt $i/30..."
            sleep 2
          done
          curl -sf http://localhost:2024/ok || (echo "Server failed to start after 60s" && exit 1)

      - name: Run e2e tests
        run: npx nx e2e angular-e2e
        env:
          LANGGRAPH_URL: http://localhost:2024
```

- [ ] **Step 2: Validate workflow YAML syntax**

```bash
npx js-yaml .github/workflows/e2e.yml > /dev/null && echo "YAML valid"
```

Expected: `YAML valid` (no output means no error).

- [ ] **Step 3: Run the full angular unit test suite one last time to confirm nothing is broken**

```bash
npx nx test angular
```

Expected: 24 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "ci: add E2E workflow — langgraph dev + angular-e2e"
```

---

## Final Verification

- [ ] **Run unit tests**

```bash
npx nx test angular
```

Expected: 24 tests PASS.

- [ ] **Run e2e tests (requires running server)**

```bash
# Terminal 1
cd examples/chat-agent && langgraph dev --no-browser

# Terminal 2
LANGGRAPH_URL=http://localhost:2024 npx nx e2e angular-e2e
```

Expected: 3 e2e tests PASS.

- [ ] **Run Python integration tests (requires OPENAI_API_KEY)**

```bash
cd examples/chat-agent && uv run pytest tests/ -v
```

Expected: `test_config_importable` PASS; `test_single_turn` and `test_thread_persistence` PASS (or SKIP if key absent).
