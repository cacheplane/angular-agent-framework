# SPDX-License-Identifier: MIT
from fastapi import FastAPI
from agent_framework_ag_ui import add_agent_framework_fastapi_endpoint

from .agent import agent

app = FastAPI(title="cockpit-runtimes-microsoft-agent-framework")
add_agent_framework_fastapi_endpoint(app, agent, path="/agent")


@app.get("/ok")
def ok() -> dict:
    return {"ok": True}
