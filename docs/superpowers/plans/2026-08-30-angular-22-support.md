# Angular 22 Consumer Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Angular 22 to Threadplane's supported consumer contract and prove Angular 20, 21, and 22 compatibility with strict installs, production builds, and backend-free browser smoke tests against identical packed artifacts.

**Architecture:** Keep the root authoring/build toolchain on Angular 21. Introduce an executable version registry for fresh consumers, build the publishable packages once, and test the resulting `dist/libs` artifact in a three-major CI matrix. Make package peers, component change-detection behavior, pricing data, and documentation explicit and enforce their agreement with a drift verifier.

**Tech Stack:** Angular 20/21/22, TypeScript 5.9/6.0, Node 22.22.3, npm, Nx, ng-packagr partial-Ivy, Node test runner, Vitest, Playwright, GitHub Actions.

---

## Required workflows and constraints

- Use `@superpowers:test-driven-development` for Tasks 1–8: add a failing focused test, observe the expected failure, implement the minimum change, then rerun the focused test.
- Use `@superpowers:verification-before-completion` before every task commit and before the final completion claim.
- Use `npm` and Nx commands from the repository root. Pass `workdir` rather than changing directories inside shell commands.
- Do not upgrade root Angular, Nx, TypeScript, or Node dependency declarations in this plan.
- Do not run documentation generators unless an edited source is confirmed to feed generated output.
- Preserve unrelated worktree changes. This plan document is committed before execution begins; `35449fdf` remains the design-review boundary used for the final aggregate diff.

## File structure

### New files

| Path | Responsibility |
| --- | --- |
| `examples/chat/smoke/angular-versions.mjs` | Executable Angular 20/21/22 lane registry and peer-range constant |
| `examples/chat/smoke/angular-versions.spec.mjs` | Registry completeness and invalid-major tests |
| `examples/chat/smoke/consumer-package.mjs` | Pure package-rewrite and strict npm-environment helpers |
| `examples/chat/smoke/consumer-package.spec.mjs` | Package rewrite and strict-install tests |
| `examples/chat/smoke/template/src/compatibility-probe.ts` | Reachable runtime imports and visible AG-UI probe |
| `examples/chat/smoke/runtime-smoke.mjs` | Backend-free Chromium bootstrap verification |
| `examples/chat/smoke/runtime-smoke.spec.mjs` | Runtime-smoke argument and package-marker contract tests |
| `libs/chat/src/lib/a2ui/catalog/change-detection.spec.ts` | Guards explicit eager-compatible metadata on catalog components |
| `scripts/verify-angular-support.mjs` | Checks peer ranges, supported-major data, and final support status |
| `scripts/verify-angular-support.spec.mjs` | Drift-verifier regression tests |
| `apps/website/src/components/pricing/angular-support.mjs` | Structured website compatibility rows |

### Existing files modified

- Smoke harness: `examples/chat/smoke/cli.mjs`, `examples/chat/smoke/project.json`, `examples/chat/smoke/README.md`, `examples/chat/smoke/template/package.json`, `examples/chat/smoke/template/src/main.ts`.
- Explicit change detection: the 12 A2UI catalog component files listed in Task 4.
- Angular peers: `libs/{chat,langgraph,ag-ui,render,telemetry,cockpit-telemetry,example-layouts}/package.json` and `package-lock.json`.
- Pricing: `CompatibilityMatrix.tsx`, `CompatibilityMatrix.spec.tsx`, `PricingDetails.tsx`.
- CI scope and workflow: nine `project.json` files listed in Task 7, `scripts/ci-scope.mjs`, `scripts/ci-scope.spec.mjs`, `scripts/ci-workflow.spec.mjs`, `.github/workflows/ci.yml`.
- Public docs: root/package READMEs and four active installation pages listed in Task 8.

## Task 1: Add the executable Angular version registry

**Files:**

- Create: `examples/chat/smoke/angular-versions.mjs`
- Create: `examples/chat/smoke/angular-versions.spec.mjs`

- [ ] **Step 1: Write the failing registry tests**

Create `angular-versions.spec.mjs`:

```js
// SPDX-License-Identifier: MIT
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANGULAR_LANES,
  ANGULAR_PEER_RANGE,
  SUPPORTED_ANGULAR_MAJORS,
  getAngularLane,
} from './angular-versions.mjs';

describe('Angular consumer version registry', () => {
  it('supports exactly Angular 20, 21, and 22', () => {
    assert.deepEqual(SUPPORTED_ANGULAR_MAJORS, [20, 21, 22]);
    assert.equal(ANGULAR_PEER_RANGE, '^20.0.0 || ^21.0.0 || ^22.0.0');
  });

  it('defines deterministic framework, tooling, and Node versions per lane', () => {
    for (const major of SUPPORTED_ANGULAR_MAJORS) {
      const lane = ANGULAR_LANES[major];
      assert.equal(lane.major, major);
      assert.match(lane.node, /^22\./);
      for (const name of [
        '@angular/common', '@angular/compiler', '@angular/core', '@angular/forms',
        '@angular/platform-browser', '@angular/router', '@angular/cdk',
        '@angular/google-maps',
      ]) {
        assert.match(lane.dependencies[name], new RegExp(`^${major}\\.`), `${major} mislabeled ${name}`);
      }
      for (const name of ['@angular/build', '@angular/cli', '@angular/compiler-cli']) {
        assert.match(lane.devDependencies[name], new RegExp(`^${major}\\.`), `${major} mislabeled ${name}`);
      }
      assert.ok(lane.devDependencies.typescript, `${major} missing typescript`);
    }
  });

  it('uses TypeScript 6 only for Angular 22', () => {
    assert.match(ANGULAR_LANES[20].devDependencies.typescript, /^5\.9\./);
    assert.match(ANGULAR_LANES[21].devDependencies.typescript, /^5\.9\./);
    assert.match(ANGULAR_LANES[22].devDependencies.typescript, /^6\.0\./);
  });

  it('rejects unsupported majors with the accepted values', () => {
    assert.throws(
      () => getAngularLane('23'),
      /Unsupported Angular major 23\. Expected one of: 20, 21, 22/
    );
  });
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run:

```bash
node --test examples/chat/smoke/angular-versions.spec.mjs
```

Expected: FAIL because `angular-versions.mjs` does not exist.

- [ ] **Step 3: Implement the registry**

Create `angular-versions.mjs` with these exact lane versions, current as of the design date:

```js
// SPDX-License-Identifier: MIT

export const ANGULAR_PEER_RANGE = '^20.0.0 || ^21.0.0 || ^22.0.0';
export const SUPPORTED_ANGULAR_MAJORS = Object.freeze([20, 21, 22]);

function lane(major, framework, cli, cdk, typescript) {
  return Object.freeze({
    major,
    node: '22.22.3',
    dependencies: Object.freeze({
      '@angular/common': framework,
      '@angular/compiler': framework,
      '@angular/core': framework,
      '@angular/forms': framework,
      '@angular/platform-browser': framework,
      '@angular/router': framework,
      '@angular/cdk': cdk,
      '@angular/google-maps': cdk,
    }),
    devDependencies: Object.freeze({
      '@angular/build': cli,
      '@angular/cli': cli,
      '@angular/compiler-cli': framework,
      typescript,
    }),
  });
}

export const ANGULAR_LANES = Object.freeze({
  20: lane(20, '20.3.30', '20.3.35', '20.2.14', '5.9.3'),
  21: lane(21, '21.2.22', '21.2.22', '21.2.14', '5.9.3'),
  22: lane(22, '22.1.4', '22.1.6', '22.1.4', '6.0.3'),
});

export function getAngularLane(value) {
  const major = Number(value);
  const selected = ANGULAR_LANES[major];
  if (!selected) {
    throw new Error(
      `Unsupported Angular major ${value}. Expected one of: ${SUPPORTED_ANGULAR_MAJORS.join(', ')}`
    );
  }
  return selected;
}
```

- [ ] **Step 4: Run the focused tests**

Run:

```bash
node --test examples/chat/smoke/angular-versions.spec.mjs
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit the registry**

```bash
git add examples/chat/smoke/angular-versions.mjs examples/chat/smoke/angular-versions.spec.mjs
git commit -m "test(smoke): define Angular compatibility lanes"
```

## Task 2: Make consumer package generation deterministic and strict

**Files:**

- Create: `examples/chat/smoke/consumer-package.mjs`
- Create: `examples/chat/smoke/consumer-package.spec.mjs`
- Modify: `examples/chat/smoke/cli.mjs`
- Modify: `examples/chat/smoke/template/package.json`
- Modify: `examples/chat/smoke/project.json`
- Modify: `examples/chat/smoke/README.md`

- [ ] **Step 1: Write failing tests for package rewriting and strict npm configuration**

Create `consumer-package.spec.mjs` covering:

```js
// SPDX-License-Identifier: MIT
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ANGULAR_LANES, getAngularLane } from './angular-versions.mjs';
import { applyAngularLane, strictNpmEnv } from './consumer-package.mjs';
import { parseArgs } from './cli.mjs';

describe('applyAngularLane', () => {
  for (const major of [20, 21, 22]) {
    it(`rewrites every Angular and TypeScript package for Angular ${major}`, () => {
      const original = {
        dependencies: Object.fromEntries(
          Object.keys(ANGULAR_LANES[major].dependencies).map((name) => [name, 'old'])
        ),
        devDependencies: Object.fromEntries(
          Object.keys(ANGULAR_LANES[major].devDependencies).map((name) => [name, 'old'])
        ),
      };
      original.dependencies.keep = '1.0.0';
      const result = applyAngularLane(original, ANGULAR_LANES[major]);
      assert.deepEqual(
        Object.fromEntries(Object.keys(ANGULAR_LANES[major].dependencies).map(
          (name) => [name, result.dependencies[name]]
        )),
        ANGULAR_LANES[major].dependencies
      );
      assert.deepEqual(
        Object.fromEntries(Object.keys(ANGULAR_LANES[major].devDependencies).map(
          (name) => [name, result.devDependencies[name]]
        )),
        ANGULAR_LANES[major].devDependencies
      );
      assert.equal(result.dependencies.keep, '1.0.0');
      assert.notEqual(result, original);
    });
  }
});

describe('strictNpmEnv', () => {
  it('overrides repository and user legacy-peer settings', () => {
    const env = strictNpmEnv({ EXISTING: 'yes', npm_config_legacy_peer_deps: 'true' });
    assert.equal(env.EXISTING, 'yes');
    assert.equal(env.npm_config_legacy_peer_deps, 'false');
    assert.equal(env.NPM_CONFIG_LEGACY_PEER_DEPS, 'false');
  });
});

describe('--angular-major parsing', () => {
  it('accepts a supported value', () => {
    assert.equal(parseArgs(['--angular-major', '22']).angularMajor, '22');
  });

  it('rejects a missing value', () => {
    assert.throws(() => parseArgs(['--angular-major']), /--angular-major requires a value/);
  });

  it('rejects an unsupported value during lane selection', () => {
    const options = parseArgs(['--angular-major', '23']);
    assert.throws(() => getAngularLane(options.angularMajor), /Unsupported Angular major 23/);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail because the helper is missing**

Run:

```bash
node --test examples/chat/smoke/consumer-package.spec.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the pure helpers**

Create `consumer-package.mjs`:

```js
// SPDX-License-Identifier: MIT

export function applyAngularLane(packageJson, selectedLane) {
  return {
    ...packageJson,
    dependencies: {
      ...packageJson.dependencies,
      ...selectedLane.dependencies,
    },
    devDependencies: {
      ...packageJson.devDependencies,
      ...selectedLane.devDependencies,
    },
  };
}

export function strictNpmEnv(base = process.env) {
  return {
    ...base,
    npm_config_legacy_peer_deps: 'false',
    NPM_CONFIG_LEGACY_PEER_DEPS: 'false',
  };
}
```

- [ ] **Step 4: Refactor `cli.mjs` to use the selected lane**

Make these precise changes:

1. Import `getAngularLane`, `applyAngularLane`, and `strictNpmEnv`.
2. Add `angularMajor: '21'` to defaults and parse `--angular-major`.
3. Call `getAngularLane(options.angularMajor)` immediately after parsing arguments, before resolving or deleting the target.
4. Replace `pinPackageSpecs` with `writeConsumerPackage({ target, version, packageSpecs, angularLane })`; apply the lane before pinning Threadplane tarballs.
5. Include Angular major, framework version, TypeScript version, and required Node version in `SMOKE_RUN.md`.
6. Pass `env: strictNpmEnv()` to the child `npm install`.
7. Extend `runChild` to forward `opts.env`.
8. Immediately before install, print `Angular lane <major>: framework <version>, TypeScript <version>, Node >=<version>` so an install failure is diagnosable without opening `SMOKE_RUN.md`.
9. Export `parseArgs`, guard the CLI entrypoint with `process.argv[1] === fileURLToPath(import.meta.url)`, and import `getAngularLane` in the parsing test so tests can exercise the CLI without running `main()`.

The child spawn must become:

```js
const child = spawn(cmd, args, {
  cwd: opts.cwd,
  env: opts.env ?? process.env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
```

- [ ] **Step 5: Repair the template's direct dependency closure**

Keep the Angular 21 values as readable defaults—they are overwritten by the registry—and add these dependencies to `examples/chat/smoke/template/package.json`:

```json
"@angular/cdk": "21.2.14",
"@angular/google-maps": "21.2.14",
"@ag-ui/client": "^0.0.52",
"@ag-ui/core": "^0.0.52",
"@json-render/core": "^0.16.0",
"@langchain/langgraph-sdk": "^1.7.4",
"@noble/ed25519": "^2.3.0",
"zod": "^3.25.0"
```

Add `"@types/google.maps": "^3.58.1"` to `devDependencies`. Do not add optional `katex` or `posthog-js` merely to silence optional peers.

Change the template build script to `"build": "ng build --configuration production"`. Add a test that reads the template manifest and asserts this exact command so every compatibility lane fulfills the production-build contract even though the template's interactive serve default remains development.

- [ ] **Step 6: Update the Nx target and smoke README**

- Add `--angular-major 21` to `examples-chat-smoke:verify-local`.
- Document `--angular-major 20|21|22`, the default of 21, exact registry pinning, and strict peer resolution.
- Remove wording that implies the template itself owns the Angular version.

- [ ] **Step 7: Run focused tests and a no-install generation for each lane**

Run:

```bash
node --test examples/chat/smoke/angular-versions.spec.mjs examples/chat/smoke/consumer-package.spec.mjs
node examples/chat/smoke/cli.mjs --non-interactive --fresh --target /tmp/threadplane-ng20-plan-smoke --version 0.0.62 --angular-major 20 --no-install --no-start
node examples/chat/smoke/cli.mjs --non-interactive --fresh --target /tmp/threadplane-ng21-plan-smoke --version 0.0.62 --angular-major 21 --no-install --no-start
node examples/chat/smoke/cli.mjs --non-interactive --fresh --target /tmp/threadplane-ng22-plan-smoke --version 0.0.62 --angular-major 22 --no-install --no-start
node --input-type=module -e "import assert from 'node:assert/strict'; import { readFile } from 'node:fs/promises'; import { ANGULAR_LANES } from './examples/chat/smoke/angular-versions.mjs'; for (const major of [20,21,22]) { const pkg=JSON.parse(await readFile('/tmp/threadplane-ng'+major+'-plan-smoke/package.json','utf8')); for (const [name,version] of Object.entries(ANGULAR_LANES[major].dependencies)) assert.equal(pkg.dependencies[name],version,name); for (const [name,version] of Object.entries(ANGULAR_LANES[major].devDependencies)) assert.equal(pkg.devDependencies[name],version,name); }"
```

Expected: tests PASS; the integration assertion proves all generated manifests contain every selected lane version; no install occurs.

- [ ] **Step 8: Commit the deterministic generator**

```bash
git add examples/chat/smoke
git commit -m "feat(smoke): generate strict versioned Angular consumers"
```

## Task 3: Add reachable package probes and backend-free runtime smoke

**Files:**

- Create: `examples/chat/smoke/template/src/compatibility-probe.ts`
- Create: `examples/chat/smoke/runtime-smoke.mjs`
- Create: `examples/chat/smoke/runtime-smoke.spec.mjs`
- Modify: `examples/chat/smoke/template/src/main.ts`
- Modify: `examples/chat/smoke/cli.mjs`
- Modify: `examples/chat/smoke/README.md`

- [ ] **Step 1: Write the failing runtime contract test**

The test must import exported parsing/constants from `runtime-smoke.mjs` and inspect the template probe source:

```js
// SPDX-License-Identifier: MIT
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { COMPATIBILITY_PACKAGES, parseRuntimeArgs } from './runtime-smoke.mjs';

describe('runtime compatibility smoke', () => {
  it('requires a generated target directory', () => {
    assert.throws(() => parseRuntimeArgs([]), /--target is required/);
  });

  it('requires visible markers for every public Angular package', async () => {
    assert.deepEqual(COMPATIBILITY_PACKAGES, [
      'ag-ui', 'chat', 'langgraph', 'render', 'telemetry',
    ]);
    const source = await readFile(
      new URL('./template/src/compatibility-probe.ts', import.meta.url),
      'utf8'
    );
    for (const packageName of COMPATIBILITY_PACKAGES) {
      assert.match(
        source,
        new RegExp(`data-threadplane-compatibility=["']${packageName}["']`)
      );
    }
  });

  it('stubs the cold-start thread refresh and telemetry endpoints', async () => {
    const source = await readFile(new URL('./runtime-smoke.mjs', import.meta.url), 'utf8');
    assert.match(source, /\/threads\/search/);
    assert.match(source, /\/ingest/);
  });
});
```

- [ ] **Step 2: Run it and verify the missing-module failure**

Run:

```bash
node --test examples/chat/smoke/runtime-smoke.spec.mjs
```

Expected: FAIL because `runtime-smoke.mjs` and the probe do not exist.

- [ ] **Step 3: Add the Angular compatibility probe**

Create a standalone component that:

- imports `provideFakeAgent` and `injectAgent` from `@threadplane/ag-ui`;
- holds reachable runtime references to `ChatComponent`, LangGraph `provideAgent`, `RenderSpecComponent`, and `provideThreadplaneTelemetry`;
- renders one visible `<span data-threadplane-compatibility="...">... ready</span>` for each of `ag-ui`, `chat`, `langgraph`, `render`, and `telemetry`;
- bootstraps with `provideFakeAgent({ tokens: ['compatibility'] })` so AG-UI dependency injection is executed without a backend.

Use this implementation shape:

```ts
// SPDX-License-Identifier: MIT
import {
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { injectAgent as injectAgUiAgent, provideFakeAgent } from '@threadplane/ag-ui';
import { ChatComponent } from '@threadplane/chat';
import { provideAgent as provideLangGraphAgent } from '@threadplane/langgraph';
import { RenderSpecComponent } from '@threadplane/render';
import { provideThreadplaneTelemetry } from '@threadplane/telemetry/browser';

const PACKAGE_REFS = [
  ['chat', ChatComponent],
  ['langgraph', provideLangGraphAgent],
  ['render', RenderSpecComponent],
  ['telemetry', provideThreadplaneTelemetry],
] as const;

@Component({
  selector: 'threadplane-compatibility-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside aria-label="Threadplane compatibility probes">
      <span data-threadplane-compatibility="ag-ui">
        {{ agUiReady ? 'ag-ui ready' : 'ag-ui unavailable' }}
      </span>
      <span data-threadplane-compatibility="chat">{{ packageReady('chat') ? 'chat ready' : 'chat unavailable' }}</span>
      <span data-threadplane-compatibility="langgraph">{{ packageReady('langgraph') ? 'langgraph ready' : 'langgraph unavailable' }}</span>
      <span data-threadplane-compatibility="render">{{ packageReady('render') ? 'render ready' : 'render unavailable' }}</span>
      <span data-threadplane-compatibility="telemetry">{{ packageReady('telemetry') ? 'telemetry ready' : 'telemetry unavailable' }}</span>
    </aside>
  `,
  styles: [`
    :host { display: block; font: 10px/1.2 monospace; padding: 2px 4px; }
    span + span { margin-left: 4px; }
  `],
})
class CompatibilityProbeComponent {
  private readonly agUiAgent = injectAgUiAgent();
  protected readonly agUiReady = Boolean(this.agUiAgent);
  private readonly packageRefs = Object.fromEntries(PACKAGE_REFS) as Record<string, unknown>;

  protected packageReady(name: string) {
    return Boolean(this.packageRefs[name]);
  }
}

export function bootstrapCompatibilityProbe() {
  const host = document.createElement('threadplane-compatibility-probe');
  document.body.append(host);
  return bootstrapApplication(CompatibilityProbeComponent, {
    providers: [
      provideZonelessChangeDetection(),
      ...provideFakeAgent({ tokens: ['compatibility'] }),
    ],
  });
}
```

- [ ] **Step 4: Bootstrap the probe from template `main.ts`**

Use one shared failure path:

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { bootstrapCompatibilityProbe } from './compatibility-probe';

Promise.all([
  bootstrapApplication(App, appConfig),
  bootstrapCompatibilityProbe(),
]).catch((err) => console.error(err));
```

- [ ] **Step 5: Implement `runtime-smoke.mjs`**

The script must:

1. Export `COMPATIBILITY_PACKAGES` and `parseRuntimeArgs` for the unit test.
2. Require `--target`; accept optional `--port` defaulting to `4300`.
3. Spawn `npm run start -- --configuration production --host 127.0.0.1 --port <port>` in the generated target. The explicit production configuration selects the copied `environment.ts`, whose backend and telemetry endpoints are under `/api`; do not rely on the template's default development serve configuration. On POSIX, spawn the server in its own process group (`detached: true`) so teardown can terminate both npm and the Angular child process.
4. Poll `/embed` for at most 60 seconds.
5. Launch Chromium from the root `@playwright/test` dependency.
6. Before navigation, route `**/api/**` inside Playwright. Fulfill `POST /api/threads/search` with HTTP 200 and `[]`, fulfill `/api/ingest` with HTTP 204, and fail the smoke on any other `/api/` request so new cold-start backend dependencies cannot appear silently.
7. Start Playwright tracing with screenshots and DOM snapshots.
8. Fail on `pageerror` or console `error` after the deterministic API routes are installed. Do not add a blanket console exception for `LangGraphThreadsAdapter.refresh`; the `/threads/search` stub must make refresh resolve cleanly.
9. Assert the “How can I help?” heading, message input, one welcome suggestion, and all five compatibility markers are visible.
10. Require the AG-UI marker text to equal `ag-ui ready`.
11. On failure, write `runtime-smoke.png` and `runtime-smoke-trace.zip` under the generated target and include captured server output in the thrown error.
12. Always close the browser and terminate the complete server process tree in `finally`. On POSIX call `process.kill(-child.pid, 'SIGTERM')`; on Windows call `child.kill('SIGTERM')`. Ignore only `ESRCH`, which means the process already exited.

Install the route before `page.goto()`:

```js
await page.route('**/api/**', async (route) => {
  const request = route.request();
  const pathname = new URL(request.url()).pathname;
  if (request.method() === 'POST' && pathname.endsWith('/threads/search')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return;
  }
  if (request.method() === 'POST' && pathname.endsWith('/ingest')) {
    await route.fulfill({ status: 204, body: '' });
    return;
  }
  throw new Error(`Unexpected backend request during compatibility smoke: ${request.method()} ${pathname}`);
});
```

The structural unit assertion above prevents a later refactor from removing the backend-free stubs while retaining the “no console errors” assertion. Also assert that the spawn arguments contain `--configuration`, `production`. The browser execution remains the behavioral proof that the stub response shapes are accepted by the SDK.

Guard `main()` with `process.argv[1] === fileURLToPath(import.meta.url)` so tests can import the module without starting a server.

- [ ] **Step 6: Add `--runtime` to the smoke CLI**

Parse a boolean `--runtime` option. Require installation when runtime is requested, invoke:

```js
await runChild(process.execPath, [join(SCRIPT_DIR, 'runtime-smoke.mjs'), '--target', target], {
  cwd: SCRIPT_DIR,
});
```

Run it after the production build and document it in the README. Keep `--runtime` opt-in locally; CI will always pass it.

- [ ] **Step 7: Run the focused tests**

Run:

```bash
node --test examples/chat/smoke/runtime-smoke.spec.mjs
```

Expected: tests PASS. Full browser execution waits until Task 5, when peer ranges permit strict Angular 22 installation.

- [ ] **Step 8: Commit runtime compatibility coverage**

```bash
git add examples/chat/smoke
git commit -m "test(smoke): add browser compatibility probes"
```

## Task 4: Make A2UI catalog change detection version-independent

**Files:**

- Create: `libs/chat/src/lib/a2ui/catalog/change-detection.spec.ts`
- Modify:
  - `libs/chat/src/lib/a2ui/catalog/audio-player.component.ts`
  - `libs/chat/src/lib/a2ui/catalog/card.component.ts`
  - `libs/chat/src/lib/a2ui/catalog/column.component.ts`
  - `libs/chat/src/lib/a2ui/catalog/divider.component.ts`
  - `libs/chat/src/lib/a2ui/catalog/icon.component.ts`
  - `libs/chat/src/lib/a2ui/catalog/image.component.ts`
  - `libs/chat/src/lib/a2ui/catalog/list.component.ts`
  - `libs/chat/src/lib/a2ui/catalog/modal.component.ts`
  - `libs/chat/src/lib/a2ui/catalog/row.component.ts`
  - `libs/chat/src/lib/a2ui/catalog/tabs.component.ts`
  - `libs/chat/src/lib/a2ui/catalog/text.component.ts`
  - `libs/chat/src/lib/a2ui/catalog/video.component.ts`

- [ ] **Step 1: Write the failing explicit-metadata test**

Create a Vitest table containing the 12 filenames and component classes. For each row:

```ts
const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
expect(source).toContain('changeDetection: ChangeDetectionStrategy.Default');
expect((component as unknown as { ɵcmp: { onPush: boolean } }).ɵcmp.onPush).toBe(false);
```

Import each component directly from its file. Do not use `a2uiBasicCatalog()` because the test must name the source file that omitted metadata.

- [ ] **Step 2: Run the focused spec and confirm all 12 rows fail on the source assertion**

Run:

```bash
npx nx test chat -- --run libs/chat/src/lib/a2ui/catalog/change-detection.spec.ts
```

Expected: 12 failures reporting missing explicit `ChangeDetectionStrategy.Default`.

- [ ] **Step 3: Add explicit Default metadata**

In each listed component:

1. Add `ChangeDetectionStrategy` to the `@angular/core` import.
2. Add `changeDetection: ChangeDetectionStrategy.Default,` immediately after `standalone: true` or `selector` according to local decorator ordering.

Do not convert these components to OnPush in this support change. The purpose is to preserve their Angular 20/21 behavior when linked by Angular 22.

- [ ] **Step 4: Run the focused and full chat tests**

Run:

```bash
npx nx test chat -- --run libs/chat/src/lib/a2ui/catalog/change-detection.spec.ts
npx nx test chat
```

Expected: focused test reports 12 passing rows; full chat suite PASS.

- [ ] **Step 5: Commit explicit behavior**

```bash
git add libs/chat/src/lib/a2ui/catalog
git commit -m "fix(chat): preserve A2UI change detection across Angular versions"
```

## Task 5: Widen peer ranges and prove source/package metadata agreement

**Files:**

- Create: `scripts/verify-angular-support.mjs`
- Create: `scripts/verify-angular-support.spec.mjs`
- Modify: `libs/chat/package.json`
- Modify: `libs/langgraph/package.json`
- Modify: `libs/ag-ui/package.json`
- Modify: `libs/render/package.json`
- Modify: `libs/telemetry/package.json`
- Modify: `libs/cockpit-telemetry/package.json`
- Modify: `libs/example-layouts/package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Write a failing real-repository peer-range test**

Create a Node test that imports `ANGULAR_PEER_RANGE` and a verifier function, then verifies the actual seven manifests. It must fail before the manifests are changed.

Also add isolated fixture cases proving the verifier reports:

- one missing Angular 22 peer;
- one unexpected Angular 23 peer;
- an optional Angular peer (`telemetry`) is still checked;
- a package with multiple Angular peers reports the exact field.

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run:

```bash
node --test scripts/verify-angular-support.spec.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` because the verifier does not exist yet.

- [ ] **Step 3: Implement the peer verifier**

`verify-angular-support.mjs` must export:

```js
export const ANGULAR_MANIFESTS = [
  'libs/chat/package.json',
  'libs/langgraph/package.json',
  'libs/ag-ui/package.json',
  'libs/render/package.json',
  'libs/telemetry/package.json',
  'libs/cockpit-telemetry/package.json',
  'libs/example-layouts/package.json',
];

export async function verifyPeerRanges({ root = process.cwd() } = {}) { /* ... */ }
```

For each manifest, inspect only `peerDependencies` keys beginning with `@angular/`. Require at least one Angular peer per listed manifest and require every value to equal `ANGULAR_PEER_RANGE`. Aggregate all mismatches into one thrown error so a single run reports every stale field.

When run as the main module, execute all currently implemented checks and print:

```text
Angular support metadata verified: 20, 21, 22
```

- [ ] **Step 4: Rerun the test and prove it detects the stale peers**

Run:

```bash
node --test scripts/verify-angular-support.spec.mjs
```

Expected: FAIL for the intended reason and name every current Angular peer field whose value is still `^20.0.0 || ^21.0.0`. Do not update manifests until this red assertion has been observed.

- [ ] **Step 5: Update all Angular peer ranges**

Replace every Angular peer in the seven manifests with:

```text
^20.0.0 || ^21.0.0 || ^22.0.0
```

Preserve `peerDependenciesMeta`, including telemetry's optional Angular peer.

- [ ] **Step 6: Refresh only lockfile metadata**

Run:

```bash
npm install --package-lock-only --ignore-scripts
```

Expected: exit 0. Inspect `git diff -- package-lock.json` and confirm changes are limited to workspace package peer metadata/resolution effects caused by these manifest edits.

- [ ] **Step 7: Run peer verification and production package builds**

Run:

```bash
node --test scripts/verify-angular-support.spec.mjs
node scripts/verify-angular-support.mjs
npx nx run-many -t build --projects=chat,langgraph,ag-ui,render,a2ui,licensing,telemetry --configuration=production
node scripts/verify-release-versions.mjs
```

Expected: all commands PASS. Inspect `dist/libs/{chat,langgraph,ag-ui,render,telemetry}/package.json` and confirm emitted public peers include Angular 22.

- [ ] **Step 8: Run all three strict local consumer lanes under supported Node**

First verify:

```bash
node --version
```

Expected: `v22.22.3` or a newer version allowed by Angular 22. If the current shell is older, switch the shell's Node runtime before continuing; do not bypass engine checks.

Then run each lane with a distinct target:

```bash
node examples/chat/smoke/cli.mjs --non-interactive --fresh --target /tmp/threadplane-angular-20 --local-dist-root dist/libs --angular-major 20 --install --build --runtime
node examples/chat/smoke/cli.mjs --non-interactive --fresh --target /tmp/threadplane-angular-21 --local-dist-root dist/libs --angular-major 21 --install --build --runtime
node examples/chat/smoke/cli.mjs --non-interactive --fresh --target /tmp/threadplane-angular-22 --local-dist-root dist/libs --angular-major 22 --install --build --runtime
```

Expected for every lane: strict `npm install`, production `ng build`, and five-package browser markers PASS without `--legacy-peer-deps` or `--force`.

- [ ] **Step 9: Commit peer support**

```bash
git add libs/chat/package.json libs/langgraph/package.json libs/ag-ui/package.json libs/render/package.json libs/telemetry/package.json libs/cockpit-telemetry/package.json libs/example-layouts/package.json package-lock.json scripts/verify-angular-support.mjs scripts/verify-angular-support.spec.mjs
git commit -m "feat: add Angular 22 package peers"
```

## Task 6: Make pricing support data structured and drift-checked

**Files:**

- Create: `apps/website/src/components/pricing/angular-support.mjs`
- Modify: `apps/website/src/components/pricing/CompatibilityMatrix.tsx`
- Modify: `apps/website/src/components/pricing/CompatibilityMatrix.spec.tsx`
- Modify: `apps/website/src/components/pricing/PricingDetails.tsx`
- Modify: `scripts/verify-angular-support.mjs`
- Modify: `scripts/verify-angular-support.spec.mjs`

- [ ] **Step 1: Update the component test first**

Change the conservative-content test to require:

- `Angular 20, 21, 22` in the Supported row;
- the Planned row to contain `—` rather than Angular 22;
- no text matching `Planned.*Angular 22`.

Add a test that imports the structured data and asserts its supported majors equal `[20, 21, 22]`.

- [ ] **Step 2: Run the website spec and verify the missing-module failure**

Run:

```bash
npx nx test website -- --run apps/website/src/components/pricing/CompatibilityMatrix.spec.tsx
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` because `angular-support.mjs` does not exist yet.

- [ ] **Step 3: Add structured pricing data that preserves the current stale status**

Create `angular-support.mjs`:

```js
// SPDX-License-Identifier: MIT

export const WEBSITE_SUPPORTED_ANGULAR_MAJORS = Object.freeze([20, 21]);

export const ANGULAR_COMPATIBILITY_ROWS = Object.freeze([
  { label: 'Supported', versions: 'Angular 20, 21', tone: 'success' },
  { label: 'Experimental', versions: '—', tone: 'warn' },
  { label: 'Planned', versions: 'Angular 22', tone: 'info' },
  { label: 'Unsupported', versions: 'Angular ≤19', tone: 'muted' },
]);
```

Have `CompatibilityMatrix.tsx` import and render `ANGULAR_COMPATIBILITY_ROWS`. Retain a local TypeScript row type and use `satisfies`/a narrow cast if the `.mjs` inference widens `tone` to `string`.

- [ ] **Step 4: Rerun the website spec and prove it detects the stale status**

Run:

```bash
npx nx test website -- --run apps/website/src/components/pricing/CompatibilityMatrix.spec.tsx
```

Expected: FAIL for the intended reason: supported majors are `[20, 21]`, the Supported row omits 22, and the Planned row still contains Angular 22.

- [ ] **Step 5: Mark Angular 22 supported in structured data**

Change the module to the final state:

```js
export const WEBSITE_SUPPORTED_ANGULAR_MAJORS = Object.freeze([20, 21, 22]);

export const ANGULAR_COMPATIBILITY_ROWS = Object.freeze([
  { label: 'Supported', versions: 'Angular 20, 21, 22', tone: 'success' },
  { label: 'Experimental', versions: '—', tone: 'warn' },
  { label: 'Planned', versions: '—', tone: 'info' },
  { label: 'Unsupported', versions: 'Angular ≤19', tone: 'muted' },
]);
```

Change `PricingDetails.tsx` to `Angular 20, 21, and 22 support`.

- [ ] **Step 6: Extend the drift verifier**

Import `WEBSITE_SUPPORTED_ANGULAR_MAJORS` from the `.mjs` module. Add `verifyWebsiteMajors()` that compares it with `SUPPORTED_ANGULAR_MAJORS` and checks that the Planned row does not contain any supported major. Invoke it from the CLI entrypoint.

Add failing fixture tests for:

- website missing Angular 22;
- website advertising Angular 23;
- Angular 22 appearing under Planned.

- [ ] **Step 7: Run focused website and verifier tests**

Run:

```bash
npx nx test website -- --run apps/website/src/components/pricing/CompatibilityMatrix.spec.tsx
node --test scripts/verify-angular-support.spec.mjs
node scripts/verify-angular-support.mjs
```

Expected: all PASS.

- [ ] **Step 8: Commit structured support data**

```bash
git add apps/website/src/components/pricing scripts/verify-angular-support.mjs scripts/verify-angular-support.spec.mjs
git commit -m "feat(website): mark Angular 22 supported"
```

## Task 7: Add the artifact-based CI compatibility matrix

**Files:**

- Modify: `libs/chat/project.json`
- Modify: `libs/langgraph/project.json`
- Modify: `libs/ag-ui/project.json`
- Modify: `libs/render/project.json`
- Modify: `libs/a2ui/project.json`
- Modify: `libs/licensing/project.json`
- Modify: `libs/telemetry/project.json`
- Modify: `examples/chat/angular/project.json`
- Modify: `examples/chat/smoke/project.json`
- Modify: `scripts/ci-scope.mjs`
- Modify: `scripts/ci-scope.spec.mjs`
- Modify: `scripts/ci-workflow.spec.mjs`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Write failing scope-classifier tests**

Add `angular_compatibility` to the expected `SCOPE_KEYS` list and tests proving:

- a publishable package tagged `scope:angular-compatibility` sets both its existing scopes and `angular_compatibility`;
- `examples-chat-angular` and `examples-chat-smoke` can set `angular_compatibility` without forcing unrelated scopes;
- unrelated website-only and PostHog changes leave it false;
- global CI files still return full scope including the new key.

Add direct changed-file tests proving `angular_compatibility` becomes true even with an empty affected-project list for:

- `scripts/verify-angular-support.mjs` and its spec;
- each of the seven public/internal Angular-facing manifests, including `libs/cockpit-telemetry/package.json` and `libs/example-layouts/package.json`;
- `apps/website/src/components/pricing/angular-support.mjs`, `CompatibilityMatrix.tsx`, and `PricingDetails.tsx`;
- the root/package README files and four active installation pages from Task 8;
- any file below `examples/chat/smoke/` or `examples/chat/angular/src/app/`.

- [ ] **Step 2: Write failing workflow-shape tests**

Extend `ci-workflow.spec.mjs` with helpers that slice the `library`, `angular-compatibility`, and `required-pr-checks` jobs. Assert:

1. `library` uploads `dist/libs` as `threadplane-library-dist`.
2. `angular-compatibility` needs both `ci-scope` and `library`.
3. The matrix is exactly `[20, 21, 22]` and uses Node `22.22.3`.
4. The job downloads `threadplane-library-dist`, installs Chromium, and invokes the smoke CLI with `--install --build --runtime`.
5. `required-pr-checks` includes the job and calls `require_scoped "angular_compatibility"`.
6. The library job condition includes the new scope, guaranteeing the artifact producer runs for smoke-only compatibility changes.
7. A failure-only artifact upload retains `runtime-smoke.png` and `runtime-smoke-trace.zip` for each matrix lane.

- [ ] **Step 3: Run the CI tests and observe failures**

Run:

```bash
node --test scripts/ci-scope.spec.mjs scripts/ci-workflow.spec.mjs
```

Expected: FAIL on the absent scope key, artifact upload, matrix job, and required-check wiring.

- [ ] **Step 4: Tag the affected Nx projects**

Add `scope:angular-compatibility` to the tags of:

- the seven artifact-producing library projects (`chat`, `langgraph`, `ag-ui`, `render`, `a2ui`, `licensing`, `telemetry`);
- `examples-chat-angular`, because its `src/app` is copied into the consumer;
- `examples-chat-smoke`, because it owns the generator and template.

Do not add the tag to every example or website project.

- [ ] **Step 5: Add the new CI scope output**

Add `angular_compatibility` to `SCOPE_KEYS` after `library`. Export and implement `isAngularCompatibilityChange(changedFiles)` using an exact file set plus these two prefixes:

```js
const ANGULAR_COMPATIBILITY_PREFIXES = [
  'examples/chat/smoke/',
  'examples/chat/angular/src/app/',
];
```

The exact file set contains the verifier/spec, all seven manifests from Task 5, the three pricing support files, all README files and installation pages from Task 8, and the two internal manifests called out in Step 1. After Nx affected tags are mapped, set `scope.angular_compatibility = true` when this function matches. This direct path rule ensures metadata-only changes cannot skip the verifier even when Nx has no affected project.

Expose the new scope from the `ci-scope` job as:

```yaml
angular_compatibility: ${{ steps.scope.outputs.angular_compatibility }}
```

Update the test's documented key count from 10 to 11.

- [ ] **Step 6: Upload one production artifact from the library job**

Change the library condition to run when either `library` or `angular_compatibility` is selected. After all production builds and verification steps pass, add:

```yaml
- name: Upload production library artifact
  uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
  with:
    name: threadplane-library-dist
    path: dist/libs
    if-no-files-found: error
    retention-days: 1
```

Also run these focused metadata tests in the library job before upload:

```yaml
- run: node --test examples/chat/smoke/*.spec.mjs scripts/verify-angular-support.spec.mjs
- run: node scripts/verify-angular-support.mjs
```

- [ ] **Step 7: Add the three-major matrix job**

Add a job immediately after `library`:

```yaml
angular-compatibility:
  name: "Angular ${{ matrix.angular }} — packaged consumer"
  needs: [ci-scope, library]
  if: github.event_name == 'push' || needs.ci-scope.outputs.angular_compatibility == 'true'
  runs-on: ubuntu-latest
  timeout-minutes: 20
  strategy:
    fail-fast: false
    matrix:
      angular: [20, 21, 22]
  steps:
    - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
    - uses: actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f # v6.3.0
      with:
        node-version: 22.22.3
        cache: npm
    - run: npm ci
    - name: Download production library artifact
      uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4.3.0
      with:
        name: threadplane-library-dist
        path: dist/libs
    - name: Install Chromium
      run: npx playwright install --with-deps chromium
    - name: Generate, install, build, and run consumer
      run: >-
        node examples/chat/smoke/cli.mjs
        --non-interactive --fresh
        --target "${{ runner.temp }}/threadplane-angular-${{ matrix.angular }}"
        --local-dist-root dist/libs
        --angular-major "${{ matrix.angular }}"
        --install --build --runtime
    - name: Upload compatibility diagnostics on failure
      if: failure()
      uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
      with:
        name: angular-${{ matrix.angular }}-compatibility-diagnostics
        path: |
          ${{ runner.temp }}/threadplane-angular-${{ matrix.angular }}/runtime-smoke.png
          ${{ runner.temp }}/threadplane-angular-${{ matrix.angular }}/runtime-smoke-trace.zip
        if-no-files-found: warn
        retention-days: 7
```

Do not rebuild libraries inside matrix lanes. The downloaded artifact is the only `dist/libs` source.

- [ ] **Step 8: Wire the stable required check**

Add `angular-compatibility` to `required-pr-checks.needs`. Add result/scope env variables and:

```bash
require_scoped \
  "angular_compatibility" \
  "Angular compatibility matrix" \
  "$RESULT_ANGULAR_COMPATIBILITY" \
  "$SCOPE_ANGULAR_COMPATIBILITY"
```

Keep the existing behavior that treats an unexpected failure/cancellation as a failure even when a scope was false.

- [ ] **Step 9: Run workflow and scope verification**

Run:

```bash
node --test scripts/ci-scope.spec.mjs scripts/ci-workflow.spec.mjs
node --test examples/chat/smoke/*.spec.mjs scripts/verify-angular-support.spec.mjs
```

Expected: all PASS.

- [ ] **Step 10: Commit CI coverage**

```bash
git add .github/workflows/ci.yml scripts/ci-scope.mjs scripts/ci-scope.spec.mjs scripts/ci-workflow.spec.mjs libs/chat/project.json libs/langgraph/project.json libs/ag-ui/project.json libs/render/project.json libs/a2ui/project.json libs/licensing/project.json libs/telemetry/project.json examples/chat/angular/project.json examples/chat/smoke/project.json
git commit -m "ci: test packaged libraries across Angular majors"
```

## Task 8: Update active compatibility documentation

**Files:**

- Modify: `README.md`
- Modify: `libs/chat/README.md`
- Modify: `libs/langgraph/README.md`
- Modify: `libs/ag-ui/README.md`
- Modify: `libs/render/README.md`
- Modify: `libs/telemetry/README.md`
- Modify: `apps/website/content/docs/chat/getting-started/installation.mdx`
- Modify: `apps/website/content/docs/langgraph/getting-started/installation.mdx`
- Modify: `apps/website/content/docs/ag-ui/getting-started/installation.mdx`
- Modify: `apps/website/content/docs/render/getting-started/installation.mdx`

- [ ] **Step 1: Add a failing documentation assertion to the drift verifier tests**

Extend `verify-angular-support.spec.mjs` so the real-repository check requires:

- the explicit peer-range blocks in the root, chat, LangGraph, AG-UI, render, and telemetry READMEs to include `^22.0.0`;
- active installation pages to contain `Angular 20, 21, and 22`;
- no active installation page to retain the exact stale range `^20.0.0 || ^21.0.0`.

Do not scan historical blog content.

- [ ] **Step 2: Run the verifier test and observe stale documentation failures**

Run:

```bash
node --test scripts/verify-angular-support.spec.mjs
```

Expected: FAIL and list the active documents that still omit Angular 22.

- [ ] **Step 3: Update README badges and peer blocks**

- Change package badges from `Angular 20+ | 21` to `Angular 20 | 21 | 22` with URL-encoded badge text.
- Keep broad prose such as “Angular 20+” where it remains accurate.
- Add `|| ^22.0.0` to every explicit Angular peer block.
- Do not change historical comparisons or unrelated positioning copy.

- [ ] **Step 4: Update the four installation pages**

Each page must state:

```text
Supported Angular majors: 20, 21, and 22.
Angular 22 requires Node.js 22.22.3 or a supported newer Node line.
```

Update the chat page's explicit peer-range list to include Angular 22. Preserve other dependency guidance.

- [ ] **Step 5: Confirm generated-context scope**

Run:

```bash
rg -n "Angular 20|Angular 21|Angular 22|\^20\.0\.0" apps/website/public
```

Expected: no generated public-context file requiring regeneration. If the command finds a generated file whose source was changed, stop and identify the smallest documented generator before running it.

- [ ] **Step 6: Run docs, website, and drift verification**

Run:

```bash
node --test scripts/verify-angular-support.spec.mjs
node scripts/verify-angular-support.mjs
npx nx lint website
npx nx test website
npx nx build website
```

Expected: all PASS. No API or narrative docs generator should be needed because no API/JSDoc source changes in this task.

- [ ] **Step 7: Commit documentation**

```bash
git add README.md libs/chat/README.md libs/langgraph/README.md libs/ag-ui/README.md libs/render/README.md libs/telemetry/README.md apps/website/content/docs/chat/getting-started/installation.mdx apps/website/content/docs/langgraph/getting-started/installation.mdx apps/website/content/docs/ag-ui/getting-started/installation.mdx apps/website/content/docs/render/getting-started/installation.mdx scripts/verify-angular-support.mjs scripts/verify-angular-support.spec.mjs
git commit -m "docs: document Angular 22 support"
```

## Task 9: Run the full release gate and review the final diff

**Files:**

- Verify all files changed by Tasks 1–8; no new implementation files are expected.

- [ ] **Step 1: Confirm supported Node and clean dependency state**

Run:

```bash
node --version
npm ci
```

Expected: Node `v22.22.3` or a supported newer line; `npm ci` exits 0.

- [ ] **Step 2: Run all new focused tests**

Run:

```bash
node --test examples/chat/smoke/*.spec.mjs scripts/verify-angular-support.spec.mjs scripts/ci-scope.spec.mjs scripts/ci-workflow.spec.mjs
node scripts/verify-angular-support.mjs
```

Expected: all tests and drift checks PASS.

- [ ] **Step 3: Run targeted lint and unit tests**

Run:

```bash
npx nx run-many -t lint --projects=chat,langgraph,ag-ui,render,telemetry
npx nx run-many -t test --projects=chat,langgraph,ag-ui,render,telemetry
```

Expected: all five project lint and test targets PASS.

- [ ] **Step 4: Build the exact release artifact set**

Run:

```bash
npx nx run-many -t build --projects=chat,langgraph,ag-ui,render,a2ui,licensing,telemetry --configuration=production
node scripts/verify-release-versions.mjs
```

Expected: all production builds and release-version checks PASS.

- [ ] **Step 5: Repeat the strict three-major consumer matrix**

Run the three Task 5 smoke commands again using fresh targets and `--runtime`. Do not reuse existing consumer `node_modules` directories.

Expected: Angular 20, 21, and 22 each pass strict install, production build, canonical welcome render, AG-UI injection, and all five package markers.

- [ ] **Step 6: Verify website changes**

Run:

```bash
npx nx lint website
npx nx test website
npx nx build website
```

Expected: PASS.

- [ ] **Step 7: Inspect package tarballs and final diff**

Run:

```bash
npm pack dist/libs/chat --dry-run
npm pack dist/libs/langgraph --dry-run
npm pack dist/libs/ag-ui --dry-run
npm pack dist/libs/render --dry-run
npm pack dist/libs/telemetry --dry-run
git diff --check 35449fdf..HEAD
git diff --stat 35449fdf..HEAD
git status --short
```

Expected:

- tarball previews contain the expected package metadata and build outputs;
- diff check reports no whitespace errors;
- only the committed implementation plan plus Angular 22 support files are present after `35449fdf`;
- worktree is clean after all logical commits.

- [ ] **Step 8: Record any verification limits**

If a local environment cannot run Node 22.22.3+, Chromium, or one of the consumer lanes, do not claim the release gate passed. Report the exact skipped command and rely on the corresponding CI matrix result before merging.

## Out of scope follow-up

Create a separate spec and plan before upgrading the root workspace to Angular 22. That follow-up must cover Nx 23.1+, TypeScript 6 configuration changes, Node enforcement across all `npm ci` jobs, Angular migrations, and Angular/TypeScript-coupled tooling upgrades. None of those upgrades belong in this implementation plan.
