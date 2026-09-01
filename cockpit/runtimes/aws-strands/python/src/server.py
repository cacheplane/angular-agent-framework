# SPDX-License-Identifier: MIT
from fastapi import FastAPI
from ag_ui_strands import add_strands_fastapi_endpoint

from .agent import agent

app = FastAPI(title="cockpit-runtimes-aws-strands")
add_strands_fastapi_endpoint(app, agent, "/agent")


@app.get("/ok")
def ok() -> dict:
    return {"ok": True}
