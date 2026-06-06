import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capabilities } from './scripts/capability-registry';
// @ts-expect-error — .mjs ES module without .d.ts; the e2e tsconfig uses
// allowJs:true but this top-level test file doesn't go through that config.
import { portsFor } from '../../cockpit/ports.mjs';

interface E2eWiring {
  angularPort: number;
  langgraphCwd: string;
  langgraphPort: number;
  project: string;
  projectRoot: string;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workflows = ['.github/workflows/ci.yml'] as const;

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

function listProjectJsonFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];

  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name === 'project.json') {
        out.push(fullPath);
      }
    }
  }

  return out.sort();
}

function listFiles(root: string, predicate: (filePath: string) => boolean): string[] {
  const out: string[] = [];
  const stack = [root];

  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && predicate(fullPath)) {
        out.push(fullPath);
      }
    }
  }

  return out.sort();
}

function parseStringProperty(source: string, key: string): string | undefined {
  const match = source.match(new RegExp(`${key}:\\s*['"]([^'"]+)['"]`));
  return match?.[1];
}

function parseNumberProperty(source: string, key: string): number | undefined {
  const match = source.match(new RegExp(`${key}:\\s*(\\d+)`));
  return match ? Number(match[1]) : undefined;
}

function activeCockpitE2eWiring(): E2eWiring[] {
  return listProjectJsonFiles(join(repoRoot, 'cockpit'))
    .map((projectJsonPath) => {
      const project = JSON.parse(readFileSync(projectJsonPath, 'utf8')) as {
        name?: string;
        targets?: Record<string, unknown>;
      };
      return { project, projectJsonPath };
    })
    .filter(({ project, projectJsonPath }) => {
      return project.name?.startsWith('cockpit-') &&
        projectJsonPath.includes('/angular/') &&
        Boolean(project.targets?.['e2e']);
    })
    .map(({ project, projectJsonPath }) => {
      const projectRoot = dirname(projectJsonPath);
      const globalSetupPath = join(projectRoot, 'e2e/global-setup-impl.ts');
      const globalSetup = readFileSync(globalSetupPath, 'utf8');
      // langgraph-shaped global-setup uses `langgraphCwd`; ag-ui-shaped
      // global-setup (createAgUiGlobalSetup) uses `pythonCwd`. Both name
      // the python project's cwd — accept either.
      const langgraphCwd =
        parseStringProperty(globalSetup, 'langgraphCwd') ??
        parseStringProperty(globalSetup, 'pythonCwd');

      // Post-port-registry migration: ports are imported from
      // cockpit/ports.mjs rather than living as literals in
      // global-setup-impl.ts. Look them up by project name.
      let langgraphPort: number | undefined;
      let angularPort: number | undefined;
      try {
        const ports = portsFor(project.name) as { angular: number; langgraph: number };
        langgraphPort = ports.langgraph;
        angularPort = ports.angular;
      } catch {
        // Cap not in registry (e.g. cockpit-ag-ui-streaming-angular).
        // Fall back to parsing literals if global-setup still has them.
        langgraphPort = parseNumberProperty(globalSetup, 'langgraphPort');
        angularPort = parseNumberProperty(globalSetup, 'angularPort');
      }

      if (!project.name || !langgraphCwd || !langgraphPort || !angularPort) {
        throw new Error(`Unable to parse e2e wiring for ${relative(repoRoot, projectJsonPath)}`);
      }

      return {
        angularPort,
        langgraphCwd,
        langgraphPort,
        project: project.name,
        projectRoot,
      };
    });
}

describe('cockpit e2e wiring', () => {
  it('does not leave cockpit e2e spec files outside Nx e2e targets', () => {
    const projects = new Map(
      listProjectJsonFiles(join(repoRoot, 'cockpit')).map((projectJsonPath) => {
        const project = JSON.parse(readFileSync(projectJsonPath, 'utf8')) as {
          name?: string;
          targets?: Record<string, unknown>;
        };
        return [dirname(projectJsonPath), project] as const;
      }),
    );
    const orphanSpecs: string[] = [];

    for (const specPath of listFiles(
      join(repoRoot, 'cockpit'),
      (filePath) => filePath.includes('/angular/e2e/') && filePath.endsWith('.spec.ts'),
    )) {
      const projectRoot = specPath.slice(0, specPath.indexOf('/e2e/'));
      const project = projects.get(projectRoot);
      if (!project?.targets?.['e2e']) {
        orphanSpecs.push(relative(repoRoot, specPath));
      }
    }

    expect(orphanSpecs).toEqual([]);
  });

  it('keeps active cockpit e2e backends aligned across registry, proxy, recorders, and workflows', () => {
    const errors: string[] = [];
    const activeE2e = activeCockpitE2eWiring();

    for (const wiring of activeE2e) {
      const capability = capabilities.find((c) => c.angularProject === wiring.project);
      if (!capability) {
        errors.push(`${wiring.project}: missing capability registry entry`);
        continue;
      }

      if (capability.port !== wiring.angularPort) {
        errors.push(`${wiring.project}: registry port ${capability.port} != global setup angularPort ${wiring.angularPort}`);
      }
      if (capability.pythonPort !== undefined && capability.pythonPort !== wiring.langgraphPort) {
        errors.push(`${wiring.project}: registry pythonPort ${capability.pythonPort} != global setup langgraphPort ${wiring.langgraphPort}`);
      }
      if (capability.pythonDir !== undefined && capability.pythonDir !== wiring.langgraphCwd) {
        errors.push(`${wiring.project}: registry pythonDir ${capability.pythonDir} != global setup langgraphCwd ${wiring.langgraphCwd}`);
      }

      // Post-port-registry: proxy.conf.mjs templates the target from
      // cockpit/ports.mjs at runtime. Drift is impossible because the
      // value comes from the same registry the test already checks via
      // wiring.langgraphPort. So we just assert the .mjs file exists +
      // imports portsFor with this cap's name.
      const proxyMjs = join(wiring.projectRoot, 'proxy.conf.mjs');
      const proxyJson = join(wiring.projectRoot, 'proxy.conf.json');
      if (existsSync(proxyMjs)) {
        const text = readFileSync(proxyMjs, 'utf8');
        if (!text.includes(`portsFor('${wiring.project}')`)) {
          errors.push(`${wiring.project}: proxy.conf.mjs does not call portsFor('${wiring.project}')`);
        }
      } else if (existsSync(proxyJson)) {
        // Legacy (allowed for ag-ui exception only); not expected for any
        // cap reaching this code path.
        const proxy = JSON.parse(readFileSync(proxyJson, 'utf8')) as Record<string, { target?: string }>;
        const target = proxy['/api']?.target;
        const expectedTarget = `http://localhost:${wiring.langgraphPort}`;
        if (target !== expectedTarget) {
          errors.push(`${wiring.project}: proxy target ${target} != ${expectedTarget}`);
        }
      } else {
        errors.push(`${wiring.project}: missing proxy.conf (no .mjs or .json)`);
      }

      const scriptsDir = join(wiring.projectRoot, 'e2e/scripts');
      if (existsSync(scriptsDir)) {
        for (const script of readdirSync(scriptsDir).filter((name) => name.startsWith('record-'))) {
          const scriptPath = join(scriptsDir, script);
          const text = readFileSync(scriptPath, 'utf8');
          if (!text.includes(wiring.langgraphCwd)) {
            errors.push(`${wiring.project}: ${relative(repoRoot, scriptPath)} does not reference ${wiring.langgraphCwd}`);
          }
          if (wiring.langgraphCwd !== 'cockpit/langgraph/streaming/python' && text.includes('cockpit/langgraph/streaming/python')) {
            errors.push(`${wiring.project}: ${relative(repoRoot, scriptPath)} still references cockpit/langgraph/streaming/python`);
          }
        }
      }

      for (const workflowPath of workflows) {
        const workflow = readRepoFile(workflowPath);
        // Dispatcher pattern (post-2026-05-23): the cockpit-e2e job's matrix
        // is emitted at runtime by scripts/cockpit-matrix.mjs via
        // `cap: ${{ fromJson(needs.cockpit-e2e-dispatcher.outputs.caps) }}`.
        // Every cap with an e2e target is covered by definition — no per-cap
        // literal needed in ci.yml.
        const dispatcherCoversAllCaps = workflow.includes(
          'fromJson(needs.cockpit-e2e-dispatcher.outputs.caps)',
        );
        if (dispatcherCoversAllCaps) {
          continue;
        }
        if (!workflow.includes(wiring.project)) {
          errors.push(`${wiring.project}: ${workflowPath} does not run the e2e target`);
        }
        // Matrix-migrated jobs (cockpit-e2e) template the working-directory via
        // `${{ matrix.cap.python }}`; the python path appears in the matrix
        // entry (e.g. `python: cockpit/chat/foo/python`) instead. Accept either
        // form so matrix and non-matrix jobs both pass.
        const literalUvSync = workflow.includes(`working-directory: ${wiring.langgraphCwd}`);
        const matrixEntry = workflow.includes(`python: ${wiring.langgraphCwd}`);
        if (!literalUvSync && !matrixEntry) {
          errors.push(`${wiring.project}: ${workflowPath} does not pre-sync ${wiring.langgraphCwd}`);
        }
      }
    }

    expect(errors).toEqual([]);
  });

  it('keeps capability-registry ports aligned with cockpit/ports.mjs', async () => {
    const mismatches: string[] = [];
    for (const cap of capabilities) {
      const ports = portsFor(cap.angularProject) as { angular: number; langgraph: number };
      if (cap.port !== ports.angular) {
        mismatches.push(`${cap.id}: registry.port ${cap.port} !== ports.angular ${ports.angular}`);
      }
      if (cap.pythonPort !== undefined && cap.pythonPort !== ports.langgraph) {
        mismatches.push(`${cap.id}: registry.pythonPort ${cap.pythonPort} !== ports.langgraph ${ports.langgraph}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('every cockpit cap project declares the expected scope:* tags', () => {
    // Drift guard for the ci-scope thin-shim migration (PR #503/#507).
    // The shim reads scope:* tags off projects nx considers affected to
    // decide which CI gates to fire. A future contributor adding a new
    // cap could silently forget the tags — their changes would
    // underfire CI. This test catches that at build/test time.
    const errors: string[] = [];

    const capProjects = listProjectJsonFiles(join(repoRoot, 'cockpit'))
      .filter((p) => !p.includes('/ag-ui/'))   // ag-ui has no python; out of scope
      .filter((p) => p.includes('/angular/') || p.includes('/python/'))
      .map((p) => ({
        path: p,
        project: JSON.parse(readFileSync(p, 'utf8')) as {
          name?: string;
          tags?: string[];
          targets?: Record<string, unknown>;
        },
      }));

    for (const { path: p, project } of capProjects) {
      const tags = new Set(project.tags ?? []);
      const relPath = relative(repoRoot, p);

      // Every cap project (angular or python) must trigger cockpit_e2e
      // + cockpit_examples.
      for (const required of ['scope:cockpit-e2e', 'scope:cockpit-examples']) {
        if (!tags.has(required)) {
          errors.push(`${relPath}: missing required tag ${required}`);
        }
      }

      // Python caps with a smoke target must also trigger cockpit_smoke.
      if (p.includes('/python/') && project.targets?.['smoke']) {
        if (!tags.has('scope:cockpit-smoke')) {
          errors.push(`${relPath}: has smoke target but missing scope:cockpit-smoke`);
        }
      }
    }

    expect(errors).toEqual([]);
  });
});
