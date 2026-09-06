# Growth research application

## Managed company enrichment

The staged application exposes `growth_company`, a private compiled adapter around
the generated Dawn company agent. Lifecycle captures bounded company evidence and
submits `{ request }`; the managed thread returns `values.result`. The agent cannot
write Growth records or send email. The local comparison harness remains available
for evaluation, independently of the production rollout switch.

Set `GROWTH_RESEARCH_PRODUCTION_MODE=managed-company-only`, `OPENAI_API_KEY`, and
the dedicated `DAWN_DATABASE_URL`. Initialize `growth_research_execution_claims`
using `createClaimStore().initialize()` before enabling invocation. Its opaque,
single-use attempt fence prevents managed replay from resetting paid-call budgets.
Do not remove an unsettled fence or mark it settled based only on elapsed time.
An otherwise valid request that expires before execution records an atomic,
already-settled rejection fence without invoking the agent. This permits cleanup
after the managed run becomes terminal. A rejection never updates an existing
fence, so a late replay cannot declare an earlier writer settled.

Configure `GROWTH_RESEARCH_TRACE_PROJECT_ID` for manually exported, sanitized
model/tool spans. The exporter accepts `GROWTH_RESEARCH_TRACE_API_KEY` and
`GROWTH_RESEARCH_TRACE_WORKSPACE_ID`, with platform-injected key fallbacks.
Missing configuration or rejected exports emit a bounded diagnostic code without
page content or credentials; they do not fail enrichment. Disable automatic
tracing with the supported runtime settings and verify actual exported payloads
using synthetic evidence before submitting company pages. Thread checkpoints and
LangSmith traces are different stores; trace deletion can remain asynchronous.

Build with `npx nx build growth-research`. If creating a source tarball on macOS,
use `COPYFILE_DISABLE=1` and inspect its entries with a platform-independent tar
reader: AppleDouble `._*` files can otherwise be interpreted as TypeScript on the
server. Never archive environment files or local evaluation records.

Code and deployment health do not establish rollout readiness. Verify semantic
quality, lost-acknowledgement reconciliation, cancellation/provider draining,
checkpoint deletion and sanitized tracing before enabling automatic publication.

## Local company research pilot

The local pilot compares one bounded Dawn agent with the existing lifecycle enrichment
generator on identical captured company evidence. It has no Growth database connection,
does not resolve people or employment, and cannot send email. The company graph is
private to the managed adapter; evaluation CLI adapters are excluded from staging.

Use Node 24 and the existing workspace dependencies. Build before running the agent:

```sh
npx nx build growth-research
npx tsx apps/growth-research/scripts/research-pilot.mts synthetic --output /absolute/private/pilot
npx tsx apps/growth-research/scripts/research-pilot.mts acquire --output /absolute/private/pilot --domains threadplane.ai,dawnai.org,neon.tech,vercel.com,resend.com,langchain.com
```

Public acquisition uses the same self-hosted Firecrawl browser capture as lifecycle.
Configure `COMPANY_SCRAPER_URL` and `COMPANY_SCRAPER_SECRET` in the operator environment;
no Firecrawl account or hosted API key is required. The old direct HTTP fetch path is
removed. See [lifecycle capture](../lifecycle/README.md#company-evidence-capture) for
the shared deadlines, size limits and network validation.

These commands return UUIDs for immutable JSON files in the selected output directory.
Acquisition records complete, empty and failed outcomes for the bounded homepage request.
A captured homepage is complete even when the browser redirects; this does not mean
the entire company website was crawled. Historical reports can contain partial outcomes.
Each capture's `pageDiagnostics` records provider, bounded outcome, API status, page
status and known byte count when available. Diagnostics contain no response bodies,
exception messages, company URLs or credentials. Access-denial status alone does not
prove bot detection. Caller cancellation rejects acquisition. Missing diagnostic entries
can mean a request was not attempted or an injected capture function did not emit them.
Review the captured corpus before model calls:
remove personal biography/contact snippets, retain empty cases and failures, and fill
expected claims/unknowns from the actual captured evidence. Save the reviewed corpus
under a new name/version. Acquisition is preparation, not a human quality label.

Set `GROWTH_RESEARCH_PILOT_MODE=local-company-only` and configure `OPENAI_API_KEY`
for the agent or `ANTHROPIC_API_KEY` for the baseline through the operator environment.
Never include keys in arguments, fixtures, reports or commits. The local in-process
case context is also required: an environment flag alone cannot authorize pilot tools.

```sh
npx tsx apps/growth-research/scripts/research-pilot.mts run --output /absolute/private/pilot --corpus /absolute/private/pilot/CORPUS_UUID.json --approach agent
npx tsx apps/growth-research/scripts/research-pilot.mts run --output /absolute/private/pilot --corpus /absolute/private/pilot/CORPUS_UUID.json --approach baseline
npx tsx apps/growth-research/scripts/research-pilot.mts inspect --output /absolute/private/pilot --run RUN_UUID
```

Each case/approach/repetition has a separate run ID, deadline, budget and terminal
record. Runs execute sequentially. The agent permits six provider requests, six evidence
reads, 1,024 output tokens per request, no provider retries, a 20-second request timeout,
and a 90-second run deadline. It can use the evidence skill and plan, read only captured
case evidence, and submit a candidate. It cannot delegate, use memory, fetch URLs or
read arbitrary files. Candidate acceptance is structural validation, not a truth label.
Explicit inspection shows company sources and candidate findings; ordinary progress
prints only opaque IDs and outcome codes. Reports use restrictive atomic writes and
refuse overwrites. Preserve the final index and all failed attempts when comparing runs.

The baseline uses its existing provider/model and 1,200-token/30-second request bounds.
It receives company mode, synthetic adapter form context and zero progress score.
Its raw citations are captured before production normalization. It does not return
quotes: `not_provided` is distinct from failing or passing exact-quote validation.
Provider failure records retain known request/usage/citation diagnostics. Missing usage
and cost are unavailable, never zero. This comparison measures whole approaches with
different providers/models; it does not isolate Dawn's causal contribution.

Raw automatic tracing is disabled for local pilot runs. The record reports
`tracing: unavailable`; this slice does not claim sanitized LangSmith tracing is live.
No research findings are automatically published to Growth or typed memory.

### Human comparison

Each invocation emits a blinded review packet. To combine baseline and agent results
for the same corpus, pass their index UUIDs; mixed corpus hashes/classes are rejected:

```sh
npx tsx apps/growth-research/scripts/research-pilot.mts review --output /absolute/private/pilot --indices BASELINE_INDEX_UUID,AGENT_INDEX_UUID
npx tsx apps/growth-research/scripts/research-pilot.mts score --output /absolute/private/pilot --packet PACKET_UUID --labels /absolute/private/pilot/human-labels.json
```

The packet omits model and approach labels. Reviewers inspect each claim and profile
against the captured sources, including failed cases. `human-labels.json` is an array:

```json
[{"reviewId":"RUN_UUID","supportedClaims":0,"reviewedClaims":0,"supportedFields":0,"applicableFields":0,"correctAbstentions":3,"applicableAbstentions":3,"contradictionsMissed":0}]
```

Use actual UUIDs and counts for each case. Reviewed claim count must match the packet;
applicable fields and abstentions come from its expected unknowns. Imported labels and
per-approach scores are persisted as a new review artifact. Aggregate quality scores
remain unavailable while reviews are incomplete, preventing success-only denominators.
Human semantic review is not replaced by model grading or string matching.

### Dogfooding findings ledger

| Finding | Evidence / owning layer | Status and next verification |
| --- | --- | --- |
| Nullable tool fields become required strings | Dawn 0.8.24 compiler JSON schema conversion; observed generated submit schema and failed unknown-field submissions | Upstream core and LangChain conversion regression/fix in progress. Pilot uses the supported authored Zod schema export; a package upgrade must rerun the original extraction probe before declaring the upstream defect released. |
| Bound model calls bypass subclass generation hooks | Real bound-model regression in this application | Guards, request counts and JSON usage capture live at the actual provider fetch boundary; generated graph tests verify it. |
| Page capture yields empty, partial, or mostly navigation evidence | Company-only acquisition against the six documented domains | Outcomes retained. Evaluate extraction improvements separately; do not hide failures by swapping cases. |
| Baseline provider rejects billing state | Live baseline synthetic calls returned a classified billing rejection | External provider funding/configuration required; no quality comparison can be claimed from failed calls. |
| Managed interruption precedes later child checkpoint | Recorded local/cloud Agent Server 0.13.4-node24 probe | Still a live-person integration gate; local cancellation tests are not proof of managed cancellation. |
| Disabled memory and shared harness persistence behavior | Earlier synthetic compatibility probe on Dawn 0.8.24 | Reproduction-needed against current Dawn before assigning a fix. Pilot has no memory and graph tests use isolated state. |

Keep source snapshots, generated reports and review labels outside git. The full growth
funnel/contact journey and real install/runtime-triggered enrichment are subsequent
slices, after supported company context and the managed data lifecycle are verified.

## Synthetic compatibility deployment

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

The compatibility routes described in this section are restricted to synthetic
work. The separately gated `growth_company` adapter is the production candidate
described above; its presence does not enable contact-triggered execution.
