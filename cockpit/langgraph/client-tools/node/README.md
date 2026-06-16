# LangGraph Client Tools — Node backend

The TypeScript/LangGraph.js twin of [`../python`](../python). Same graph behavior,
built on [`@threadplane/middleware/langgraph`](https://www.npmjs.com/package/@threadplane/middleware) —
the JS twin of the Python `threadplane-middleware`. It binds the browser-declared
client tools onto the model and ends the turn on a client-tool call so the browser
executes it and re-runs with a `ToolMessage`.

The browser declares the tools and `@threadplane/langgraph` ships the catalog as
`input.client_tools`; the graph's state channels (`clientToolsChannel()`) retain it
across the turn.

## Run

```bash
npm install
OPENAI_API_KEY=... npm run dev   # langgraphjs dev --port 5308
```

Then serve the **shared** Angular frontend — it already targets this graph
(`assistantId: "client-tools"`, `http://localhost:4308/api` → proxied to `:5308`):

```bash
npx nx serve cockpit-langgraph-client-tools-angular
```

This backend serves the LangGraph Platform API on the same port (`5308`) and graph
id (`client-tools`) as the Python backend, so the Angular app connects unchanged —
only the backend runtime (Node vs Python) differs.
