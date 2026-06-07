# SPDX-License-Identifier: MIT
"""Standalone AG-UI server for the examples/ag-ui demo.

Wraps the (transport-agnostic) chat graph with ag-ui-langgraph and serves it
over an AG-UI FastAPI endpoint at /agent. Mirrors the cockpit ag-ui pattern.

Auth is OPTIONAL for clone-and-run: the X-Internal-Token check is enforced
only when AG_UI_INTERNAL_TOKEN is set (production), so `uvicorn src.server:app`
works locally with no env beyond OPENAI_API_KEY.
"""
import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from ag_ui_langgraph import add_langgraph_fastapi_endpoint, LangGraphAgent

from .graph import graph

AG_UI_INTERNAL_TOKEN = os.environ.get("AG_UI_INTERNAL_TOKEN")

app = FastAPI(title="examples-ag-ui")


@app.middleware("http")
async def require_internal_token(request: Request, call_next):
    if request.url.path == "/ok" or not AG_UI_INTERNAL_TOKEN:
        return await call_next(request)
    if request.headers.get("x-internal-token") != AG_UI_INTERNAL_TOKEN:
        return JSONResponse(status_code=401, content={"detail": "unauthorized"})
    return await call_next(request)


@app.get("/ok")
def ok() -> dict:
    return {"ok": True}


add_langgraph_fastapi_endpoint(app, LangGraphAgent(name="chat", graph=graph), path="/agent")
