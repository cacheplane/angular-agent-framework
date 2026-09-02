import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capabilities } from './scripts/capability-registry';
import { inspectRuntimeTargetSource } from './runtime-wiring-audit';

/**
 * Guard for a failure mode production smoke cannot see.
 *
 * `scripts/assemble-examples.ts` rewrites each cockpit app's `<base href>` to
 * `/<product>/<topic>/`, and the Vercel route table only proxies
 * `^/ag-ui/([^/]+)/agent(/.*)?$` to the Railway runtime. An app that hardcodes
 * a root-absolute `'/agent'` therefore requests `https://<host>/agent`, which
 * matches no route, falls through the filesystem handle and lands on the 404
 * catch-all — while still serving a perfectly healthy 200 index.html, so every
 * page-reachability assertion keeps passing.
 *
 * Local dev is not a safety net either: dev serves with `<base href="/">`, so
 * the literal and the base-relative form resolve identically to `/agent` and
 * proxy.conf.mjs forwards both.
 *
 * The base-relative form is the only one that survives the base-href rewrite.
 */
const AGENT_URL_EXPR = "new URL('agent', document.baseURI).pathname";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Both products are served by the same aggregated AG-UI runtime and both get
 * their <base href> rewritten at assemble time, so both are exposed to this.
 */
const agentBackedCapabilities = capabilities.filter(
  (c) => c.product === 'ag-ui' || c.product === 'runtimes'
);

describe('AG-UI agent URL is resolved against <base href>', () => {
  it('covers every registered agent-backed capability', () => {
    expect(agentBackedCapabilities.length).toBeGreaterThan(0);
  });

  for (const cap of agentBackedCapabilities) {
    it(`${cap.product}/${cap.topic} resolves its agent URL relative to the base href`, () => {
      const angularRoot = join(
        repoRoot,
        'cockpit',
        cap.product,
        cap.topic,
        'angular/src'
      );
      const configPath = join(angularRoot, 'app/app.config.ts');
      const configSource = readFileSync(configPath, 'utf8');
      const entryPoints = ['main.ts', 'main.cockpit.ts'].map((fileName) => ({
        path: join(angularRoot, fileName),
        source: readFileSync(join(angularRoot, fileName), 'utf8'),
      }));

      for (const entryPoint of entryPoints) {
        const bootstrapCalls = inspectRuntimeTargetSource(
          entryPoint.source,
          entryPoint.path,
          'ag-ui'
        ).bootstrapCalls;
        expect(
          bootstrapCalls,
          `${entryPoint.path} must supply sharedUrl with ${AGENT_URL_EXPR} so it ` +
            `resolves under the deployed <base href="/${cap.product}/${cap.topic}/">`
        ).toHaveLength(1);
        expect(bootstrapCalls[0].runtimeProperties['sharedUrl']).toBe(
          AGENT_URL_EXPR
        );
      }
      const providerCalls = inspectRuntimeTargetSource(
        configSource,
        configPath,
        'ag-ui'
      ).providerCalls;
      expect(
        providerCalls,
        `${configPath} must source the runtime URL from the generation-scoped connection`
      ).toHaveLength(1);
      expect(providerCalls[0].properties['url']).toBe('connection.url');
    });
  }
});
