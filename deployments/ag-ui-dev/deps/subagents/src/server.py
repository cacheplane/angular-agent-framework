# SPDX-License-Identifier: MIT
from fastapi import FastAPI
from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from .graph import graph
from .streaming.subagent_emitting_agent import SubagentEmittingAgent

# SubagentEmittingAgent subclasses the ag-ui-langgraph bridge and wraps its
# run() generator to expand the graph's `subagent_activity` CUSTOM events into
# the protocol's standard SUBAGENT_STARTED / TEXT_MESSAGE_* (attributed via
# subagentRunId) / SUBAGENT_FINISHED / SUBAGENT_ERROR events, so the chat
# composition renders a live subagent card.
agent = SubagentEmittingAgent(name="subagents", graph=graph)
app = FastAPI(title="cockpit-ag-ui-subagents")
add_langgraph_fastapi_endpoint(app, agent, path="/agent")


@app.get("/ok")
def ok() -> dict:
    return {"ok": True}
