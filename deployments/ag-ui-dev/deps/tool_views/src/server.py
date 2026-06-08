# SPDX-License-Identifier: MIT
from fastapi import FastAPI
from ag_ui_langgraph import LangGraphAgent, add_langgraph_fastapi_endpoint
from .graph import graph

agent = LangGraphAgent(name="tool-views", graph=graph)
app = FastAPI(title="cockpit-ag-ui-tool-views")
add_langgraph_fastapi_endpoint(app, agent, path="/agent")


@app.get("/ok")
def ok() -> dict:
    return {"ok": True}
