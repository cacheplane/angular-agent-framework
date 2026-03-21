# Cockpit Module Contract

The `cockpit/` tree is product-first by design.

- product-first roots:
  - `cockpit/deep-agents/<capability>/<language>`
  - `cockpit/langgraph/<capability>/<language>`
- canonical identity stays aligned with the registry:
  - `product / section / topic / page / language`
- capability modules own runtime adapters and metadata
- docs-only entries stay in the shared manifest and website docs system

Every capability module should make the mapping between its product-first directory and the canonical registry identity explicit.
