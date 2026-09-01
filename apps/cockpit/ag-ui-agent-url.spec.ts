import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capabilities } from './scripts/capability-registry';

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

describe('ag-ui agent URL is resolved against <base href>', () => {
  it('covers every registered agent-backed capability', () => {
    expect(agentBackedCapabilities.length).toBeGreaterThan(0);
  });

  for (const cap of agentBackedCapabilities) {
    it(`${cap.product}/${cap.topic} resolves its agent URL relative to the base href`, () => {
      const configPath = join(
        repoRoot,
        'cockpit',
        cap.product,
        cap.topic,
        'angular/src/app/app.config.ts'
      );
      const source = readFileSync(configPath, 'utf8');

      expect(
        source,
        `${configPath} must build the agent URL with ${AGENT_URL_EXPR} so it ` +
          `resolves under the deployed <base href="/${cap.product}/${cap.topic}/">`
      ).toContain(AGENT_URL_EXPR);

      // A root-absolute literal silently 404s in production; see the note above.
      expect(
        source,
        `${configPath} hardcodes a root-absolute agent URL, which does not ` +
          `survive the <base href> rewrite in scripts/assemble-examples.ts`
      ).not.toMatch(/url:\s*['"`]\/agent/);
    });
  }
});
