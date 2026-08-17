# Vendored official A2UI v0.9 schemas

These JSON schemas are vendored **verbatim** from the official A2UI
specification and exist solely as fixtures for the drift tests in
`src/lib/schema-conformance.spec.ts`. They are **not** part of the published
npm package (the build copies from `src/` only).

Sources:

- `server_to_client.json` — https://a2ui.org/specification/v0_9/server_to_client.json
- `common_types.json` — https://a2ui.org/specification/v0_9/common_types.json
- `basic-catalog.json` — https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json

To refresh, re-download the files from the URLs above (keep the local
filenames). If the conformance spec then fails, the upstream spec changed —
update `src/lib/types.ts` / `src/lib/functions.ts` and the expectations in the
spec accordingly.
