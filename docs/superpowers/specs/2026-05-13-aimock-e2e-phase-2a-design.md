# aimock E2E Harness — Phase 2a (infrastructure only)

> **Place in the larger plan.** Phase 1 (input-variance tables, [#305](https://github.com/cacheplane/angular-agent-framework/pull/305)) covers parser-level invariants at unit granularity. Phase 2a stands up the cross-stack E2E harness so subsequent phases can add scenario coverage that Phase 1 cannot reach (LangGraph SSE framing, Python emit_in_place coalescing, single-bubble invariant, surface mounting). This phase ships infrastructure only — the harness, one trivial smoke fixture, and a drift-detection CI job. Real scenario coverage lands in Phase 2b+.

## Library

The harness is built around [`@copilotkit/aimock`](https://github.com/CopilotKit/aimock) — a zero-dependency mock infrastructure server that impersonates LLM APIs (OpenAI, Claude, Gemini, etc.), MCP, A2A, and other AI services on a single port. The features we use in Phase 2a:

- **Record-and-replay** — proxy a real OpenAI call once, capture as JSON fixture, replay deterministically forever.
- **OpenAI SSE stream replay** — replays captured runs token-by-token with the original streaming physics (chunk boundaries preserved).
- **Drift detection** — daily CI re-records the fixture against real OpenAI and diffs against the committed fixture; raises an issue (does not auto-update) when divergence exceeds a configurable threshold.

Future phases may also exercise aimock's chaos modes (malformed JSON, mid-stream disconnects, configurable latency) and MCP/A2A mocking. Phase 2a does not.

## Goal

Stand up an aimock-driven Playwright E2E test runner for `examples/chat` that:

1. Boots aimock alongside the existing Python LangGraph server and Angular dev server.
2. Points the LangGraph Python process at aimock via `OPENAI_BASE_URL`.
3. Drives the Angular `/embed` route in a real browser.
4. Asserts on rendered DOM against a single committed fixture.
5. Runs in CI as a new parallel job (`examples/chat — aimock e2e`).
6. Wires drift detection as a scheduled daily workflow.

After Phase 2a merges, Phase 2b's spec slot is: "add fixture + Playwright assertions for scenario X" — a small additive PR per scenario.

## Non-goals

- Replacing the existing `examples/chat — python smoke` CI job. Both run in parallel; the smoke job continues to validate real-LLM happy path.
- Editing Phase 1 unit-variance tests. They remain the fast first-line defense.
- Authoring scenario coverage beyond the single "hi" smoke fixture. Phases 2b+ add scenarios.
- Replacing OpenAI integration in non-test contexts. Production code never sees aimock.
- Auto-updating fixtures from the drift-detection job. Drift opens an issue; humans update fixtures intentionally.

## Architecture

```
[Playwright test on CI/local]
    ↓ drives real Chromium
[Angular dev server :4200]
    ↓ /threads, /runs/stream
[LangGraph dev server :2024]  (Python, existing)
    ↓ OPENAI_BASE_URL=http://localhost:AIMOCK_PORT
[aimock node process]          (NEW — replay mode in CI)
    ↑ reads fixtures/*.json
```

The LangGraph Python process and the Angular dev server are exactly as they exist today. The only addition is aimock as a separate node process listening on its own port, intercepting OpenAI HTTP calls and replaying captured SSE streams.

## File layout

All new files live under `examples/chat/aimock-e2e/`. This directory is parallel to the existing `examples/chat/smoke/` (the manual checklist) and `examples/chat/python/` (the LangGraph graph).

```
examples/chat/aimock-e2e/
├── aimock-runner.ts         # Starts/stops aimock as a child process.
├── fixtures/
│   └── hi.json              # One captured fixture: "hi" → trivial reply.
├── playwright.config.ts     # Playwright config dedicated to aimock e2e.
├── scripts/
│   └── record.ts            # Dev CLI: capture or refresh a fixture.
├── smoke.spec.ts            # The one Phase 2a test.
└── tsconfig.json
```

The directory is a single Nx project (`examples-chat-aimock-e2e`) with targets:

- `nx run examples-chat-aimock-e2e:test` — runs Playwright against replay mode (CI path).
- `nx run examples-chat-aimock-e2e:record` — runs the record script (dev-only; needs `OPENAI_API_KEY`).
- `nx run examples-chat-aimock-e2e:drift` — runs the drift-detection comparison (daily CI path).

## Components

### `aimock-runner.ts`

Programmatic API for starting and stopping aimock. Used by Playwright's `globalSetup` and by `scripts/record.ts`.

```typescript
export interface AimockHandle {
  /** Port aimock is listening on. Pass to LangGraph as OPENAI_BASE_URL. */
  port: number;
  /** Tear down the aimock process. Safe to call multiple times. */
  stop(): Promise<void>;
}

export interface AimockStartOptions {
  /** 'replay' | 'record' — record proxies to real OpenAI and writes the fixture. */
  mode: 'replay' | 'record';
  /** Path to the fixture file. Read in replay, written in record. */
  fixturePath: string;
  /** Required when mode='record'; ignored in replay. */
  upstreamApiKey?: string;
}

export function startAimock(opts: AimockStartOptions): Promise<AimockHandle>;
```

Implementation: spawns `@copilotkit/aimock` as a child process (the package ships a CLI binary). Captures `stdout` for the bound port (aimock binds to port 0 by default and reports the bound port via stdout). Resolves the promise once the server is listening.

### `playwright.config.ts`

Standard Playwright config with one fixture-aware quirk: `globalSetup` boots aimock + the Python LangGraph server + the Angular dev server, in that order; `globalTeardown` tears them down in reverse. Tests run sequentially in CI (single worker) to keep the shared aimock port from being contended; locally tests can run in parallel against multiple aimock instances if needed (Phase 2b concern, not 2a).

The LangGraph startup must set `OPENAI_BASE_URL=http://localhost:<aimock-port>` and `OPENAI_API_KEY=test-only-not-used-in-replay` (aimock accepts any key in replay mode).

### `fixtures/hi.json`

The aimock fixture format is documented at https://aimock.copilotkit.dev/docs/. Format gist: a JSON file with a list of recorded request/response pairs, each carrying the SSE chunk stream verbatim. Phase 2a commits exactly one fixture — `hi.json` — captured from a real OpenAI call with prompt "say hi briefly".

### `smoke.spec.ts`

One Playwright test:

```typescript
test('replays the "hi" fixture and renders the assistant bubble', async ({ page }) => {
  await page.goto('http://localhost:4200/embed');
  await page.getByRole('textbox', { name: /message/i }).fill('say hi briefly');
  await page.getByRole('button', { name: /send/i }).click();
  // Wait for the assistant bubble to finalize (streaming flag flips to false).
  await expect(page.locator('chat-message.assistant')).toBeVisible();
  await expect(page.locator('chat-message.assistant')).toContainText(/hi/i);
  // The bubble must be non-empty — guards against PR #290-class regressions.
  const text = await page.locator('chat-message.assistant').innerText();
  expect(text.trim().length).toBeGreaterThan(0);
});
```

This single test is the smoke. It does not lock in detailed assistant text — the fixture's text is whatever the LLM happened to say. Phase 2b's scenarios will use stricter assertions against scenario-specific fixtures.

### `scripts/record.ts`

CLI invoked locally by devs. Example:

```
OPENAI_API_KEY=sk-... npx tsx examples/chat/aimock-e2e/scripts/record.ts hi --prompt "say hi briefly"
```

Steps:
1. Start aimock in record mode targeting `fixtures/hi.json`.
2. Start LangGraph Python pointed at aimock.
3. Start Angular dev server.
4. Drive the same Playwright flow as the test.
5. Capture written fixture; verify it parses; report fixture stats (chunk count, total bytes).
6. Tear down.

Devs commit the resulting fixture to git. CI never runs this script.

## CI integration

Two new GitHub Actions jobs in `.github/workflows/`:

### `examples/chat — aimock e2e` (per-PR)

Runs on every PR. Steps:

1. Checkout, setup node + Python (matching the existing python-smoke job).
2. `nx run examples-chat-aimock-e2e:test` — Playwright in replay mode against the committed fixture.
3. Upload Playwright trace on failure.

The job runs in parallel with the existing `examples/chat — python smoke` job. It does NOT require an `OPENAI_API_KEY` secret — replay mode reads bytes from disk.

### `aimock fixture drift` (scheduled, daily)

A separate workflow on a daily cron. Steps:

1. Checkout main, setup node + Python.
2. `nx run examples-chat-aimock-e2e:drift` — runs the record script in a comparison mode (records to a temp file, diffs against the committed fixture).
3. If diff exceeds threshold, opens (or updates) a GitHub issue tagged `aimock-drift` with the diff summary.
4. Never writes to the repo.

The threshold is configured per-fixture; default tolerates token-level wording changes (which are normal LLM nondeterminism even at temperature=0 over time) but flags structural divergences (different `finish_reason`, missing trailing newline, changed tool-call schema).

Requires `OPENAI_API_KEY` secret. Confined to the scheduled workflow; per-PR jobs never see it.

## Configuration

Three new env vars used only by the aimock harness — none touch production code:

- `AIMOCK_PORT` — optional, lets the harness pin a port for local debugging. Default: bind to port 0, report bound port.
- `AIMOCK_MODE` — `replay` (default) or `record`.
- `AIMOCK_FIXTURE` — path to the fixture file.

The Python LangGraph startup honors `OPENAI_BASE_URL` (already supported by the OpenAI Python SDK); the harness sets it in the spawned LangGraph process's environment only.

## Local dev workflow

To run the new Playwright suite locally:

```
nx run examples-chat-aimock-e2e:test
```

To capture a new fixture (or refresh `hi.json`):

```
OPENAI_API_KEY=sk-... nx run examples-chat-aimock-e2e:record -- hi --prompt "say hi briefly"
git add examples/chat/aimock-e2e/fixtures/hi.json
git commit -m "test(examples-chat): refresh hi.json fixture"
```

## Risks and unknowns

- **aimock + LangGraph compatibility.** The OpenAI Python SDK's behavior when `OPENAI_BASE_URL` points at a non-OpenAI host should be tested. If aimock's SSE framing diverges from OpenAI's in a way the SDK rejects, we need to patch the harness (likely a small env-var pin or a SDK config option). De-risk by running a one-off smoke before the spec is fully implemented.
- **Port conflict with LangGraph dev server :2024.** Aimock binds to its own port (port 0 by default); no conflict expected.
- **Daily drift job false positives.** Real LLM output drifts naturally over time at the byte level. The drift threshold needs tuning. Phase 2a ships with a generous threshold; Phases 2b+ can tighten it per-fixture.
- **CI startup cost.** Spinning up aimock + LangGraph + Angular dev server takes ~30s of warm-up before any test runs. Acceptable for one job per PR. If we add many aimock jobs in Phase 2b+, share the startup via a workflow-level setup step.
- **Fixture filesize.** A single captured run is probably 5–50 KB. Phase 2a's fixture is small; no LFS or compression needed. If Phase 2b+ produces fixtures > 100 KB, revisit (probably gzip on disk, aimock supports this).

## Acceptance criteria

Phase 2a merges when:

- `nx run examples-chat-aimock-e2e:test` passes locally and in CI.
- `examples/chat/aimock-e2e/fixtures/hi.json` exists and is committed.
- The new GitHub Actions per-PR job is present, green on this branch, and runs in parallel with the existing python-smoke job.
- The new scheduled drift-detection workflow exists, has a manual `workflow_dispatch` trigger for verification, and has been manually fired once against real OpenAI to confirm it runs.
- `examples/chat/aimock-e2e/scripts/record.ts` runs locally end-to-end (manually verified — not automated).
- No production code (anything outside `examples/chat/aimock-e2e/` and the new workflow files) references aimock.
- The two new env vars (`AIMOCK_MODE`, `AIMOCK_FIXTURE`) are documented in a short README at `examples/chat/aimock-e2e/README.md`.

## What lands next (Phase 2b+, NOT this phase)

For sizing the harness correctly, the next phases will likely look like:

- **2b — markdown response scenarios.** Capture a fixture for the PR #290 regression case (no trailing newline) and assert the bubble renders non-empty. Capture a fixture for a long multi-paragraph response.
- **2c — A2UI v1 progressive surface.** Capture the parent-LLM-emits-tool-call flow; assert single-bubble invariant, progressive component mount, no skeleton residue.
- **2d — tool-call + subagent.** Capture a research subagent flow; assert subagents panel renders.
- **2e — interrupt / human-in-the-loop.** Capture an approval-request flow.

Each is a small additive PR (one new fixture file + one new spec file). Phase 2a is the substrate that makes them small.
