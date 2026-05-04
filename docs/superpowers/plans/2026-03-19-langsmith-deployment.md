# LangSmith / LangGraph Cloud Deployment Plan

**Date:** 2026-03-19
**Status:** Blocked — awaiting LangGraph Cloud access on LangSmith account
**Unblocked by:** Brian confirming LangSmith Plus/Enterprise plan is active

---

## Overview

Deploy the `examples/chat-agent` Python LangGraph agent to LangGraph Cloud (hosted on LangSmith infrastructure). Once deployed, set `NEXT_PUBLIC_LANGGRAPH_URL` in Vercel to point the live demo at the cloud endpoint.

---

## Architecture

```
Website (Vercel)
  └─ <stream-chat-demo> Angular Element
       └─ NEXT_PUBLIC_LANGGRAPH_URL
            └─ LangGraph Cloud (LangSmith)
                 └─ chat_agent graph (Python)
                      └─ ChatOpenAI (gpt-5-mini)
```

---

## The Agent

**Location:** `examples/chat-agent/`

**Key files:**

| File | Purpose |
|---|---|
| `langgraph.json` | LangGraph CLI manifest — defines graphs and Python version |
| `src/chat_agent/agent.py` | Graph definition: `StateGraph(MessagesState)` with single `call_model` node |
| `src/chat_agent/config.py` | `Configuration` TypedDict — `system_prompt` field |
| `pyproject.toml` | Python deps: `langgraph>=0.3`, `langchain-openai>=0.3`, `langsmith>=0.2` |

**Graph:** `chat_agent` — `START → call_model → END`

**`langgraph.json`:**

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

---

## Prerequisites

### 1. LangSmith account with LangGraph Cloud access

LangGraph Cloud is available on **LangSmith Plus** or **Enterprise** plans. Verify at:
https://smith.langsmith.com → your org → Deployments

### 2. `LANGSMITH_API_KEY`

Create at https://smith.langsmith.com → Settings → API Keys.

### 3. `OPENAI_API_KEY`

Required at runtime by the agent's `ChatOpenAI` call.

---

## Local Development

```bash
cd examples/chat-agent
uv sync
cp .env.example .env   # add OPENAI_API_KEY
langgraph dev --no-browser
# Server runs at http://localhost:2024
```

The CI workflow (`.github/workflows/e2e.yml`) already does this automatically and runs e2e tests against the local server.

**LangSmith tracing in dev:**

```bash
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=angular-example
LANGSMITH_API_KEY=<your key>
```

---

## Cloud Deployment

### Step 1: Install LangGraph CLI with cloud support

```bash
pip install "langgraph-cli[inmem]"
# or via uv:
uv add langgraph-cli
```

### Step 2: Authenticate

```bash
langgraph auth login
# Follow browser prompt to authenticate with your LangSmith account
```

Or set environment variable:

```bash
export LANGSMITH_API_KEY=<your key>
```

### Step 3: Deploy

```bash
cd examples/chat-agent
langgraph deploy
```

Expected output: deployment URL in the form `https://<org>-<deployment-name>.us.langgraph.app`

The `chat_agent` graph will be available at that URL.

### Step 4: Note the deployment URL and assistant ID

After deployment:
- **URL:** `https://<org>-<deployment-name>.us.langgraph.app` (or similar)
- **Assistant ID:** `chat_agent` (matches the key in `langgraph.json`)

### Step 5: Set runtime environment variables in LangGraph Cloud

From the LangSmith dashboard → Deployments → your deployment → Environment Variables:

| Variable | Value |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI key |
| `OPENAI_MODEL` | `gpt-5-mini` (default) or preferred model |
| `LANGSMITH_TRACING` | `true` (optional, for production tracing) |
| `LANGSMITH_PROJECT` | `angular-example` |

---

## Update Website After Deployment

### Step 1: Set `NEXT_PUBLIC_LANGGRAPH_URL` in Vercel

Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_LANGGRAPH_URL` | `https://<your-deployment-url>` |

Set for: Production, Preview, Development environments.

### Step 2: Redeploy website

Either push a commit or manually trigger a redeploy from the Vercel dashboard.

### Step 3: Verify live demo works

Visit https://cacheplane.ai and confirm the `<stream-chat-demo>` web component connects and streams responses.

---

## CI E2E Tests

The `.github/workflows/e2e.yml` workflow runs e2e tests against a **local** LangGraph dev server (not the cloud deployment). This is intentional — cloud tests would require a dedicated test deployment or environment.

**LangSmith CI tracing project:** `angular-e2e-ci`

---

## Notes

- The agent uses `MemorySaver` for in-process thread persistence in local dev. LangGraph Cloud automatically provides persistent storage (PostgreSQL-backed) for deployed agents — no code change needed.
- The `32-day free trial` clause in PolyForm Noncommercial covers evaluation use of the library in the demo agent — this does not affect the agent itself, which is an example under the same license.
- Future: add authentication to the LangGraph Cloud endpoint if the demo needs rate limiting or abuse protection.
