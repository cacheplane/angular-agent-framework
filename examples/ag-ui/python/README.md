# examples/ag-ui — Python backend

The (duplicated) chat a2ui graph served over AG-UI via `ag-ui-langgraph`.

```bash
cd examples/ag-ui/python
uv venv && uv sync
OPENAI_API_KEY=sk-... uv run uvicorn src.server:app --port 8000
```

`/ok` is the health route; the agent is mounted at `/agent`. The graph is
duplicated from `examples/chat/python` (copy, don't import — standalone
examples convention); it is transport-agnostic and unchanged.
