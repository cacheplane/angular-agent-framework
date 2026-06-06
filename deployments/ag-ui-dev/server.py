# GENERATED — do not edit. Source: scripts/generate-ag-ui-deployment-config.ts
# Multi-topic AG-UI FastAPI server. Aggregates each cockpit/ag-ui/*/python topic
# at /agent/<topic>. Health route /ok is unauthenticated; /agent/* requires
# X-Internal-Token matching the AG_UI_INTERNAL_TOKEN env var.
import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from ag_ui_langgraph import add_langgraph_fastapi_endpoint, LangGraphAgent

from deps.interrupts.src.graph import graph as interrupts_graph
from deps.streaming.src.graph import graph as streaming_graph

AG_UI_INTERNAL_TOKEN = os.environ["AG_UI_INTERNAL_TOKEN"]

app = FastAPI(title="ag-ui-dev")


@app.middleware("http")
async def require_internal_token(request: Request, call_next):
    # NOTE: HTTPException raised inside a Starlette BaseHTTPMiddleware bubbles
    # past FastAPI's handler and surfaces as 500. Return a JSONResponse
    # directly instead — that's the only way to emit a proper 4xx from here.
    if request.url.path == "/ok":
        return await call_next(request)
    if request.headers.get("x-internal-token") != AG_UI_INTERNAL_TOKEN:
        return JSONResponse(status_code=401, content={"detail": "unauthorized"})
    return await call_next(request)


@app.get("/ok")
def ok() -> dict:
    return {"ok": True}


add_langgraph_fastapi_endpoint(
    app,
    LangGraphAgent(name="interrupts", graph=interrupts_graph),
    path="/agent/interrupts",
)
add_langgraph_fastapi_endpoint(
    app,
    LangGraphAgent(name="streaming", graph=streaming_graph),
    path="/agent/streaming",
)
