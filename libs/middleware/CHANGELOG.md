# Changelog

## [Unreleased]

### Breaking

- `routeAfterAgent()` and `clientToolsRouter()` now default `toolsNode` to `'server_tools'` instead of `'tools'`. The old default could never work: `clientToolsChannel()` declares a `tools` state channel, and LangGraph.js shares one namespace between channel names and node names, so `addNode('tools', …)` throws *"tools is already being used as a state attribute"* on exactly the graphs these helpers are for. Any graph that relied on the old default was already passing `{ toolsNode: 'server_tools' }` (or an equivalent override) to work around it. Rename your server tool node to `server_tools` and drop the override, or keep the override pointing at whatever name your node uses. There is no shim.

  The Python package's `route_after_agent()` keeps `tools_node="tools"`; Python LangGraph does not share that namespace.
