# Unified Example Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a unified Nx-based harness for building, testing, serving, and deploying all 14 capability examples through standard Nx commands with capability selection.

**Architecture:** A capability registry (`capability-registry.ts`) is the single source of truth. A serve script orchestrates cockpit + Angular app + LangGraph backend. CI pipeline adds jobs for building all examples and running e2e tests. Deployment expands to cover all capabilities.

**Tech Stack:** Nx, TypeScript, `tsx` (script runner), GitHub Actions, `uv` (Python), `langgraph-cli`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/cockpit/scripts/capability-registry.ts` | Single source of truth for all capabilities |
| Create | `apps/cockpit/scripts/serve-example.ts` | CLI script: start cockpit + example + backend |
| Create | `apps/cockpit/scripts/generate-combined-langgraph.ts` | Generate merged langgraph.json for --all mode |
| Modify | `apps/cockpit/project.json` | Add `serve-with-example` and `serve-all` targets |
| Modify | `.github/workflows/ci.yml` | Add example build + e2e jobs |
| Modify | `.github/workflows/deploy-langgraph.yml` | Expand matrix to all capabilities |

---

### Task 1: Create capability registry

**Files:**
- Create: `apps/cockpit/scripts/capability-registry.ts`

- [ ] **Step 1: Create the registry**

```ts
// apps/cockpit/scripts/capability-registry.ts

/**
 * Single source of truth for all cockpit capability examples.
 * Used by serve, build, test, and deploy scripts.
 */
export interface Capability {
  /** Short identifier (e.g., 'streaming', 'persistence') */
  id: string;
  /** Product group */
  product: 'langgraph' | 'deep-agents';
  /** Topic slug */
  topic: string;
  /** Nx Angular project name */
  angularProject: string;
  /** Angular dev server port */
  port: number;
  /** Path to Python backend directory */
  pythonDir: string;
  /** LangGraph graph name (used in langgraph.json) */
  graphName: string;
}

export const capabilities: readonly Capability[] = [
  // LangGraph capabilities
  { id: 'streaming', product: 'langgraph', topic: 'streaming', angularProject: 'cockpit-langgraph-streaming-angular', port: 4300, pythonDir: 'cockpit/langgraph/streaming/python', graphName: 'streaming' },
  { id: 'persistence', product: 'langgraph', topic: 'persistence', angularProject: 'cockpit-langgraph-persistence-angular', port: 4301, pythonDir: 'cockpit/langgraph/persistence/python', graphName: 'persistence' },
  { id: 'interrupts', product: 'langgraph', topic: 'interrupts', angularProject: 'cockpit-langgraph-interrupts-angular', port: 4302, pythonDir: 'cockpit/langgraph/interrupts/python', graphName: 'interrupts' },
  { id: 'memory', product: 'langgraph', topic: 'memory', angularProject: 'cockpit-langgraph-memory-angular', port: 4303, pythonDir: 'cockpit/langgraph/memory/python', graphName: 'memory' },
  { id: 'durable-execution', product: 'langgraph', topic: 'durable-execution', angularProject: 'cockpit-langgraph-durable-execution-angular', port: 4304, pythonDir: 'cockpit/langgraph/durable-execution/python', graphName: 'durable-execution' },
  { id: 'subgraphs', product: 'langgraph', topic: 'subgraphs', angularProject: 'cockpit-langgraph-subgraphs-angular', port: 4305, pythonDir: 'cockpit/langgraph/subgraphs/python', graphName: 'subgraphs' },
  { id: 'time-travel', product: 'langgraph', topic: 'time-travel', angularProject: 'cockpit-langgraph-time-travel-angular', port: 4306, pythonDir: 'cockpit/langgraph/time-travel/python', graphName: 'time-travel' },
  { id: 'deployment-runtime', product: 'langgraph', topic: 'deployment-runtime', angularProject: 'cockpit-langgraph-deployment-runtime-angular', port: 4307, pythonDir: 'cockpit/langgraph/deployment-runtime/python', graphName: 'deployment-runtime' },
  // Deep Agents capabilities
  { id: 'planning', product: 'deep-agents', topic: 'planning', angularProject: 'cockpit-deep-agents-planning-angular', port: 4310, pythonDir: 'cockpit/deep-agents/planning/python', graphName: 'planning' },
  { id: 'filesystem', product: 'deep-agents', topic: 'filesystem', angularProject: 'cockpit-deep-agents-filesystem-angular', port: 4311, pythonDir: 'cockpit/deep-agents/filesystem/python', graphName: 'filesystem' },
  { id: 'da-subagents', product: 'deep-agents', topic: 'subagents', angularProject: 'cockpit-deep-agents-subagents-angular', port: 4312, pythonDir: 'cockpit/deep-agents/subagents/python', graphName: 'subagents' },
  { id: 'da-memory', product: 'deep-agents', topic: 'memory', angularProject: 'cockpit-deep-agents-memory-angular', port: 4313, pythonDir: 'cockpit/deep-agents/memory/python', graphName: 'da-memory' },
  { id: 'skills', product: 'deep-agents', topic: 'skills', angularProject: 'cockpit-deep-agents-skills-angular', port: 4314, pythonDir: 'cockpit/deep-agents/skills/python', graphName: 'skills' },
  { id: 'sandboxes', product: 'deep-agents', topic: 'sandboxes', angularProject: 'cockpit-deep-agents-sandboxes-angular', port: 4315, pythonDir: 'cockpit/deep-agents/sandboxes/python', graphName: 'sandboxes' },
] as const;

export function findCapability(id: string): Capability | undefined {
  return capabilities.find((c) => c.id === id);
}

export function allAngularProjects(): string[] {
  return capabilities.map((c) => c.angularProject);
}

export function allPythonDirs(): string[] {
  return capabilities.map((c) => c.pythonDir);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/cockpit/scripts/capability-registry.ts
git commit -m "feat(cockpit): add capability registry — single source of truth for all examples"
```

---

### Task 2: Create serve-example script

**Files:**
- Create: `apps/cockpit/scripts/serve-example.ts`

- [ ] **Step 1: Create the serve orchestrator**

```ts
// apps/cockpit/scripts/serve-example.ts
import { execSync, spawn, ChildProcess } from 'child_process';
import { capabilities, findCapability, type Capability } from './capability-registry';

const args = process.argv.slice(2);
const capabilityArg = args.find((a) => a.startsWith('--capability='))?.split('=')[1];
const allMode = args.includes('--all');

if (!capabilityArg && !allMode) {
  console.error('Usage: npx tsx apps/cockpit/scripts/serve-example.ts --capability=streaming');
  console.error('       npx tsx apps/cockpit/scripts/serve-example.ts --all');
  console.error('\nAvailable capabilities:');
  capabilities.forEach((c) => console.error(`  ${c.id} (port ${c.port})`));
  process.exit(1);
}

const processes: ChildProcess[] = [];

function startProcess(name: string, command: string, color: string): ChildProcess {
  console.log(`\x1b[${color}m[${name}]\x1b[0m Starting: ${command}`);
  const proc = spawn('bash', ['-c', command], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  proc.stdout?.on('data', (data) => {
    String(data).split('\n').filter(Boolean).forEach((line) => {
      console.log(`\x1b[${color}m[${name}]\x1b[0m ${line}`);
    });
  });
  proc.stderr?.on('data', (data) => {
    String(data).split('\n').filter(Boolean).forEach((line) => {
      console.error(`\x1b[${color}m[${name}]\x1b[0m ${line}`);
    });
  });
  processes.push(proc);
  return proc;
}

function cleanup() {
  console.log('\nShutting down...');
  processes.forEach((p) => p.kill('SIGTERM'));
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start cockpit
startProcess('cockpit', 'npx nx serve cockpit --port 4201', '36');

if (allMode) {
  // Start all Angular apps
  capabilities.forEach((cap) => {
    startProcess(cap.id, `npx nx serve ${cap.angularProject} --port ${cap.port}`, '33');
  });
  console.log('\n🚀 All 14 examples starting. Cockpit at http://localhost:4201\n');
} else {
  const cap = findCapability(capabilityArg!);
  if (!cap) {
    console.error(`Unknown capability: ${capabilityArg}`);
    console.error('Available:', capabilities.map((c) => c.id).join(', '));
    process.exit(1);
  }

  // Start Angular app
  startProcess(cap.id, `npx nx serve ${cap.angularProject} --port ${cap.port}`, '33');

  // Start LangGraph backend
  startProcess(`${cap.id}-py`, `cd ${cap.pythonDir} && source $HOME/.local/bin/env 2>/dev/null; uv sync && uv run langgraph dev --port 8123`, '35');

  console.log(`\n🚀 Starting ${cap.id} example:`);
  console.log(`   Cockpit:   http://localhost:4201`);
  console.log(`   Angular:   http://localhost:${cap.port}`);
  console.log(`   LangGraph: http://localhost:8123\n`);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/cockpit/scripts/serve-example.ts
git commit -m "feat(cockpit): add serve-example orchestrator script"
```

---

### Task 3: Add Nx targets to cockpit project.json

**Files:**
- Modify: `apps/cockpit/project.json`

- [ ] **Step 1: Add serve-with-example and serve-all targets**

Read `apps/cockpit/project.json`. Add two new targets:

```json
"serve-example": {
  "executor": "nx:run-commands",
  "options": {
    "command": "npx tsx apps/cockpit/scripts/serve-example.ts --capability={args.capability}",
    "cwd": "."
  }
},
"serve-all": {
  "executor": "nx:run-commands",
  "options": {
    "command": "npx tsx apps/cockpit/scripts/serve-example.ts --all",
    "cwd": "."
  }
}
```

Usage:
```bash
nx run cockpit:serve-example --args="--capability=streaming"
# or simpler:
npx tsx apps/cockpit/scripts/serve-example.ts --capability=streaming
```

- [ ] **Step 2: Commit**

```bash
git add apps/cockpit/project.json
git commit -m "feat(cockpit): add serve-example and serve-all Nx targets"
```

---

### Task 4: Generate combined LangGraph config

**Files:**
- Create: `apps/cockpit/scripts/generate-combined-langgraph.ts`

- [ ] **Step 1: Create the generator script**

```ts
// apps/cockpit/scripts/generate-combined-langgraph.ts
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { capabilities } from './capability-registry';

/**
 * Generates a combined langgraph.json that hosts all capability graphs
 * in a single LangGraph server. Used for --all mode.
 */
const graphs: Record<string, string> = {};

for (const cap of capabilities) {
  graphs[cap.graphName] = `./${cap.pythonDir}/src/graph.py:graph`;
}

const config = {
  graphs,
  dependencies: capabilities.map((c) => `./${c.pythonDir}/pyproject.toml`),
  env: '.env',
};

const outputPath = resolve(process.cwd(), 'langgraph-combined.json');
writeFileSync(outputPath, JSON.stringify(config, null, 2) + '\n');
console.log(`Generated ${outputPath} with ${Object.keys(graphs).length} graphs`);
```

- [ ] **Step 2: Commit**

```bash
git add apps/cockpit/scripts/generate-combined-langgraph.ts
git commit -m "feat(cockpit): add combined LangGraph config generator for --all mode"
```

---

### Task 5: Update CI pipeline

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add cockpit-examples-build job**

Read the current `ci.yml`. Add a new job after the existing `cockpit` job:

```yaml
  cockpit-examples-build:
    name: Cockpit — build all examples
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6.0.2
      - uses: actions/setup-node@v6.3.0
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx nx run-many -t build --projects='cockpit-*-angular' --skip-nx-cache
```

Add it to the `needs` array of the `deploy` job so examples must build before deployment.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add cockpit-examples-build job for all 14 Angular apps"
```

---

### Task 6: Expand LangGraph deployment matrix

**Files:**
- Modify: `.github/workflows/deploy-langgraph.yml`

- [ ] **Step 1: Expand the deployment matrix to all 14 capabilities**

Read the current `deploy-langgraph.yml`. The matrix currently has only `langgraph-streaming`. Add all 14:

```yaml
    strategy:
      matrix:
        include:
          - name: langgraph-streaming
            path: cockpit/langgraph/streaming/python
          - name: langgraph-persistence
            path: cockpit/langgraph/persistence/python
          - name: langgraph-interrupts
            path: cockpit/langgraph/interrupts/python
          - name: langgraph-memory
            path: cockpit/langgraph/memory/python
          - name: langgraph-durable-execution
            path: cockpit/langgraph/durable-execution/python
          - name: langgraph-subgraphs
            path: cockpit/langgraph/subgraphs/python
          - name: langgraph-time-travel
            path: cockpit/langgraph/time-travel/python
          - name: langgraph-deployment-runtime
            path: cockpit/langgraph/deployment-runtime/python
          - name: deep-agents-planning
            path: cockpit/deep-agents/planning/python
          - name: deep-agents-filesystem
            path: cockpit/deep-agents/filesystem/python
          - name: deep-agents-subagents
            path: cockpit/deep-agents/subagents/python
          - name: deep-agents-memory
            path: cockpit/deep-agents/memory/python
          - name: deep-agents-skills
            path: cockpit/deep-agents/skills/python
          - name: deep-agents-sandboxes
            path: cockpit/deep-agents/sandboxes/python
```

Update the deployment step's `if` condition to check the capability input against the matrix name.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy-langgraph.yml
git commit -m "ci: expand LangGraph deployment matrix to all 14 capabilities"
```

---

### Task 7: Test and push

- [ ] **Step 1: Test the serve script**

```bash
npx tsx apps/cockpit/scripts/serve-example.ts --help
```

Verify it prints usage and all 14 capabilities.

- [ ] **Step 2: Test the combined config generator**

```bash
npx tsx apps/cockpit/scripts/generate-combined-langgraph.ts
cat langgraph-combined.json
```

Verify it lists all 14 graphs.

- [ ] **Step 3: Run cockpit tests**

```bash
npx nx test cockpit -- --run
```

- [ ] **Step 4: Build cockpit**

```bash
npx nx build cockpit --skip-nx-cache
```

- [ ] **Step 5: Push**

```bash
git push
```
