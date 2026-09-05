# Growth research compatibility application

Private synthetic Dawn application, separate from lifecycle and the Python cockpit.
Published Dawn packages are pinned to `0.8.24`; the app and deployment require Node 24.
The only public graph ID is `growth_research`, pointing to the unchanged generated
Dawn `/enrichment/research#agent` entry. The safe alias avoids slash/hash routing
failures in the Agent Server's internal per-graph HTTP endpoints. Its registered researcher is
private to coordinator delegation; staging verifies the known generated specialist
entry but removes its standalone public graph key.

This app exercises authored plans, skills, scoped delegation, candidate memory and
platform thread continuation against a fixed synthetic corpus. It is disabled by
default and has no connection to Growth ingestion or campaign delivery. Configure
a dedicated memory database; do not point it at Growth's canonical database.

Dawn 0.8.24 sets the child checkpointer to `false`; `task` accepts only `subagent`
and `input`. Each delegation starts a fresh child conversation. Carry relevant
context explicitly through the checkpointed parent when delegating follow-up work.

From the workspace root on Node 24:

```sh
npm ci --ignore-scripts
npx nx test growth-research
npx nx run growth-research:check
npx nx lint growth-research
npx nx build growth-research
```

The build uses the CLI resolved from this application and checks its version before
execution. Dawn emits a LangSmith entry under `.dawn/build`. Packaging preserves
that entry and the relative `src/` and `dawn.config.ts` layout, stages approved files
under `.deployment`, and normalizes `langgraph.json` to Node 24, `dependencies: ["."]`
and `env: {}`. Configure secret values in the deployment environment. Generated
`.dawn/routes/*/tools.json` schemas are preserved because actual tool execution needs
them; arbitrary build files and all environment files remain excluded. The artifact
pins Agent Server `api_version: "0.13.4"` and contains a standalone NodeNext
`tsconfig.json` for the official server's static schema extractor. It does not inherit
the monorepo's compiler configuration or path aliases.

`deployment-package-lock.json` is the standalone runtime dependency lock. To update
it after changing direct dependencies, use `deploymentManifest()` from
`scripts/package-langsmith.mts` to write a temporary standalone `package.json`, run
`npm install --package-lock-only --ignore-scripts --workspaces=false` there, and copy
its lock to `deployment-package-lock.json`. The build rejects stale direct dependency
locks. Do not copy the monorepo lock or workspace dependencies into the artifact.
The workspace lock keeps this app's dependency tree nested so its testing helpers
and runtime resolve Dawn 0.8.24 while lifecycle retains Dawn 0.8.21.

Set `GROWTH_RESEARCH_FIXTURE_MODE=synthetic-only` explicitly to permit model calls.
The default blocks them. The fixed corpus contains `atlas` and `beacon`; tools accept
only those identifiers and cannot fetch URLs, read arbitrary files or execute shell
commands. The specialist is explicitly registered with delegation denied by default
and only that specialist allowed. It can read fixtures but is denied the shared
coordinator summary tool. Planning and skill instructions are authored beside the
coordinator route.

For a local active-child cancellation probe, the operator may set
`GROWTH_RESEARCH_FIXTURE_DELAY_MS` to an integer from 0 to 5000. It defaults to zero;
the model cannot choose a delay. The fixture tool cooperatively observes cancellation
while paused and rechecks both cancellation and fixture mode before returning data.

The public Dawn `seedModelImporter` bootstrap installs a process-wide bounded
OpenAI model for this isolated app. Every request is gated, including cached models.
It uses `gpt-4.1-mini`, a 1,024-token output cap, zero provider retries and a 20-second
request timeout. Credential-free schema extraction can construct the model with a
construction-only placeholder; invocation and actual HTTP fetch reject absent real
credentials, so the placeholder is never sent. Route recursion is limited to 12 steps and Dawn retries to one
attempt. These are compatibility-probe bounds, not a shared spending reservation or
production provider selection. Provider-free tests inspect actual request bodies,
verify one request on a retryable failure, and observe a stalled request timing out.

Candidate memory uses an explicit lazy pgvector store via `DAWN_DATABASE_URL`, with
8-dimensional deterministic synthetic embeddings. Generated `remember` writes are
candidates and normal `recall` excludes them. Missing database configuration fails
when durable memory is accessed; there is no SQLite fallback. The eager prompt index
is explicitly disabled with `indexMaxEntries: 0`; a zero-result search returns an
empty list without opening a connection. This allows credential-free graph import
and packaging while positive-limit recall and all writes still require the database.
This index setting is necessary because Dawn 0.8.24 does not consult `memory.enabled`
when a route-local memory declaration exists.

Run the separate, uncached integration target only against a disposable database:

```sh
GROWTH_RESEARCH_TEST_DATABASE_URL='postgres://…' npx nx run growth-research:test-memory-integration
```

The probe requires that variable and never falls back to a production URL. It uses
fresh child processes for generated candidate writes, active recall, slot isolation
and deletion, and deletes only the fixture record it created. Memory namespaces use
the stable `growth-research` workspace and route plus a server-owned `GROWTH_RESEARCH_FIXTURE_SLOT` (`atlas` or
`beacon`, default `atlas`). These are trusted synthetic deployment slots, not
authenticated account identities. The explicit workspace remains stable across source,
staging and relocated deployment directories, which the subprocess test verifies.
Dawn's scope callback has no authenticated user;
production tenancy still requires separate application-owned authorization. Synthetic
hash embeddings do not establish semantic retrieval quality for live data.

Build, staging, standalone installation, and native Node graph import require no
model or database credentials. Native import is only a packaging check; run server
and cloud smoke checks separately to exercise the deployment boundary. The server's static
schema extractor still emits a nonfatal `Unsupported type: never` diagnostic; the
tested runtime operations succeeded despite it. Fast tests use the public Dawn
harness and a local mock model; memory persistence is verified separately against
PostgreSQL.

Run the fast and database suites sequentially: Dawn's local testing harness uses a
shared checkpoint file, so overlapping those commands can produce a SQLite lock
error. This does not change the deployed graph's LangSmith checkpoint ownership or
its separate pgvector memory store.

Agent Server `0.13.4-node24` can acknowledge interruption before its JavaScript child
stops, allowing a later result checkpoint. The generated Dawn graph cancels when a
live `config.signal` is supplied; the official JS sidecar does not forward that
signal. No vendor patch is included. Cancellation and protection against writes
after cancellation remain failed live-use gates. The smoke client's cleanup command
refuses interrupted threads; an operator must independently establish worker
quiescence before deleting those records. A terminal run status alone is insufficient.
Deploy the verified artifact with the official CLI `0.4.21` source archive layout
and the LangSmith control-plane source-upload API. Updates should target the existing deployment ID:
request its upload URL, upload only the verified `.deployment` archive, and submit
the returned object path with `revision_source: "internal_source"`,
`langgraph_config_path: "langgraph.json"`, and `install_command: "npm ci --ignore-scripts"`.
The signed upload requires `Content-Type: application/gzip` and
`X-Goog-Content-Length-Range: 0,209715200`. Configure secrets through the deployment
API; never include an environment file in the archive. Re-enabling synthetic model
tests requires both a provider key and the explicit fixture-mode value. Do not wire
real Growth signals into this deployment until its remaining live-use gates pass.

The uncached platform smoke target takes positional fixture, thread and correlation
identifiers. Set `GROWTH_RESEARCH_URL`, `LANGSMITH_API_KEY` when authentication is
required, and the explicit fixture-mode gate in the operator environment:

```sh
npx nx run growth-research:smoke-langsmith -- direct THREAD_UUID SMOKE_ID
```

Other phases are `delegated`, `memory`, `continuation`, and `cleanup`. Continuation
uses the same thread and smoke ID after a direct run; cleanup verifies ownership
and rejects active or interrupted runs, then deletes the fixture thread and verifies
absence. Interrupted fixtures require the separate operator procedure described above.

This application is restricted to synthetic compatibility work. It does not collect
real people or companies, publish account facts, or dispatch campaigns. Live use still
requires trusted scopes, source controls, budget enforcement, a durable Growth work
ledger, publication validation and cross-store deletion safeguards.
