# Browser-Executed Client Tools with LangGraph

<Summary>
The LangGraph-direct twin of the AG-UI client-tools example. Tools are declared
in the Angular app with `tools()`, `action()`, `view()`, and `ask()` from
`@threadplane/chat`; the `@threadplane/langgraph` adapter ships the catalog to
the backend as `input.client_tools`. The LangGraph graph declares a
`client_tools` channel, binds the client stubs with `bind_client_tools` (no
server implementation), and routes to `END` so the browser executes the tool and
re-submits a `ToolMessage` the model then summarizes. The behaviors (`action`
function, `view` inline component, `ask` HITL component) are identical to the
AG-UI example — only the transport differs.
</Summary>

<Related>
- [AG-UI Client Tools](/ag-ui/core-capabilities/client-tools/overview/python) — The same three behaviors over the AG-UI transport, with the full conceptual walkthrough.
</Related>
