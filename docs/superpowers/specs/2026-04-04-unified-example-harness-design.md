# Unified Example Harness Architecture

## Problem

The cockpit has 14 capability examples, each with independent Angular apps, Python backends, docs, and e2e tests. There's no unified way to:
- Start the cockpit + a specific example's full stack with one command
- Build and test all examples in CI
- Deploy all examples to production
- Generate a new example from a template

## Goal

Create a unified Nx-based harness that supports the full lifecycle: local dev → CI build/test → deployment — all orchestrated through standard Nx commands with capability selection.

## Architecture

### 1. Local Development

#### Single-capability mode
```bash
nx serve cockpit --capability=streaming
```

This starts three processes:
1. **Cockpit** — Next.js dev server on port 4201
2. **Angular example** — `cockpit-langgraph-streaming-angular` on port 4300
3. **LangGraph backend** — `langgraph dev` on port 8123

The cockpit's Run mode embeds the Angular app via iframe. Code/Docs/API modes show the example's source files.

#### All-capabilities mode
```bash
nx serve cockpit --all
```

Starts the cockpit + all 14 Angular dev servers (ports 4300-4315) + a single shared LangGraph dev server. The LangGraph server hosts all graphs (each capability's `langgraph.json` merged into one manifest).

#### Implementation

A custom `serve-with-examples` target on the cockpit project using `nx:run-commands`:

```json
{
  "serve-with-examples": {
    "executor": "nx:run-commands",
    "options": {
      "commands": [
        "npx nx serve cockpit --port 4201",
        "npx nx serve {capability-angular-project} --port {port}",
        "cd cockpit/{product}/{topic}/python && uv run langgraph dev --port 8123"
      ],
      "parallel": true
    }
  }
}
```

A script `apps/cockpit/scripts/serve-example.ts` handles the `--capability` flag:
- Maps capability name → Nx project name + port + Python directory
- Runs all three commands in parallel
- Logs output with color-coded prefixes

For `--all` mode, the script starts all 14 Angular servers and a multi-graph LangGraph server.

### 2. Capability Registry

A machine-readable registry at `apps/cockpit/scripts/capability-registry.ts`:

```typescript
export const capabilities = [
  {
    id: 'streaming',
    product: 'langgraph',
    topic: 'streaming',
    angularProject: 'cockpit-langgraph-streaming-angular',
    pythonDir: 'cockpit/langgraph/streaming/python',
    port: 4300,
    langGraphPort: 8123,
  },
  {
    id: 'persistence',
    product: 'langgraph',
    topic: 'persistence',
    angularProject: 'cockpit-langgraph-persistence-angular',
    pythonDir: 'cockpit/langgraph/persistence/python',
    port: 4301,
    langGraphPort: 8124,
  },
  // ... all 14 capabilities
] as const;
```

This registry is the single source of truth for all automation scripts — serve, build, test, deploy, and scaffolding all read from it.

### 3. CI Pipeline

New CI jobs in `.github/workflows/ci.yml`:

#### Build all Angular examples
```yaml
cockpit-examples-build:
  name: Cockpit — build all examples
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6.0.2
    - uses: actions/setup-node@v6.3.0
      with: { node-version: 22, cache: npm }
    - run: npm ci
    - run: npx nx run-many -t build --projects='cockpit-*-angular' --skip-nx-cache
```

#### Smoke test all Python modules
Already exists in `cockpit-smoke` job — the `run-many -t smoke` command covers all 14.

#### E2e test examples (secret-gated)
```yaml
cockpit-examples-e2e:
  name: Cockpit — example e2e (secret-gated)
  runs-on: ubuntu-latest
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  steps:
    - uses: actions/checkout@v6.0.2
    - uses: actions/setup-node@v6.3.0
      with: { node-version: 22, cache: npm }
    - uses: astral-sh/setup-uv@v8.0.0
      with: { python-version: '3.12' }
    - run: npm ci
    - run: npx playwright install --with-deps chromium
    # Start streaming example (the reference example with e2e coverage)
    - run: |
        cd cockpit/langgraph/streaming/python && uv sync && uv run langgraph dev --port 8123 &
        sleep 10
        npx nx serve cockpit-langgraph-streaming-angular --port 4300 &
        sleep 15
        npx playwright test cockpit/langgraph/streaming/angular/e2e/
      env:
        OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### 4. Deployment

#### Angular examples → Vercel
Each Angular example builds to `dist/cockpit/{product}/{topic}/angular/browser/`. These can be:
- **Option A**: Deployed as part of the cockpit Vercel project (static output directory includes examples)
- **Option B**: Deployed independently via the existing `deploy-langgraph.yml` workflow

Recommendation: **Option A** — the cockpit's `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL` resolves to the deployed Vercel URL where examples are hosted alongside the cockpit.

#### Python backends → LangGraph Cloud
The existing `deploy-langgraph.yml` workflow expands its matrix to all 14 capabilities:

```yaml
strategy:
  matrix:
    include:
      - name: streaming
        path: cockpit/langgraph/streaming/python
      - name: persistence
        path: cockpit/langgraph/persistence/python
      # ... all 14
```

### 5. Example Generator (nx generator)

A custom Nx generator for scaffolding new capabilities:

```bash
nx generate @cacheplane/cockpit:capability \
  --product=langgraph \
  --topic=new-feature \
  --port=4320
```

This creates the full directory structure:
- `cockpit/{product}/{topic}/angular/` — Angular app (from template)
- `cockpit/{product}/{topic}/python/` — Python backend (from template)
- Updates `capability-registry.ts`
- Registers the module in `route-resolution.ts`

Template files are stored in `tools/generators/capability/files/`.

### 6. Shared LangGraph Server

For `--all` mode, instead of running 14 separate LangGraph servers, a single server hosts all graphs. A combined `langgraph.json` is generated from all capability modules:

```json
{
  "graphs": {
    "streaming": "../cockpit/langgraph/streaming/python/src/graph.py:graph",
    "persistence": "../cockpit/langgraph/persistence/python/src/graph.py:graph",
    "interrupts": "../cockpit/langgraph/interrupts/python/src/graph.py:graph"
  },
  "dependencies": ["./pyproject.toml"],
  "env": ".env"
}
```

A script `apps/cockpit/scripts/generate-combined-langgraph.ts` reads the capability registry and produces this file.

## Implementation Order

1. **Capability registry** — `apps/cockpit/scripts/capability-registry.ts`
2. **Serve script** — `apps/cockpit/scripts/serve-example.ts` with `--capability` and `--all`
3. **Nx target** — Add `serve-with-examples` to cockpit `project.json`
4. **CI jobs** — Add `cockpit-examples-build` and `cockpit-examples-e2e`
5. **Combined LangGraph server** — Script to generate merged `langgraph.json`
6. **Deployment matrix** — Expand `deploy-langgraph.yml`
7. **Nx generator** — Template-based scaffolding (future, lower priority)

## Out of Scope

- Hot module replacement across cockpit ↔ example boundaries
- Shared Python virtualenv across capabilities
- Angular SSR for examples (all CSR)
- Example versioning (all examples track main branch)
