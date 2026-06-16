# SPDX-License-Identifier: MIT
from fastapi import FastAPI
from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from .graph import graph
from .streaming.activity_emitting_agent import ActivityEmittingAgent

# ActivityEmittingAgent subclasses the ag-ui-langgraph bridge to convert the
# graph's `subagent_activity` CUSTOM events into native AG-UI ACTIVITY events
# (snapshot/delta) so the chat composition renders a live subagent card.
agent = ActivityEmittingAgent(name="subagents", graph=graph)
app = FastAPI(title="cockpit-ag-ui-subagents")
add_langgraph_fastapi_endpoint(app, agent, path="/agent")


@app.get("/ok")
def ok() -> dict:
    return {"ok": True}
