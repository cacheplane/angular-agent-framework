import * as http from 'node:http';
import * as https from 'node:https';
import { resolve } from 'node:path';
import {
  cockpitManifest,
  getCanonicalWebsiteWorkspaceHref,
  getWorkspaceDestinationPath,
  resolveLegacyPath,
  resolveLegacyRequestMode,
  type CockpitManifestEntry,
  type WorkspaceMode,
  type WorkspaceResolution,
} from '@threadplane/cockpit-registry';

export type DeploySmokeMode = 'preview' | 'production';

export interface RedirectSmokeRequest {
  readonly origin: string;
  readonly path: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface RedirectSmokeResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string | undefined>>;
}

export type RedirectSmokeRequestImpl = (
  request: RedirectSmokeRequest
) => Promise<RedirectSmokeResponse>;

export interface RedirectSmokeCase {
  readonly name: string;
  readonly path: string;
  readonly expectedStatus: 308 | 404;
  readonly expectedLocation?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly raw?: boolean;
  /**
   * Vercel's CDN collapses consecutive slashes and answers 308 to the
   * single-slash path on the same origin before any route, rewrite, or
   * function runs, so a raw probe carrying `//` can never reach the 404
   * route in vercel.cockpit.json. The only acceptable non-404 answer for such
   * a probe is that exact same-origin normalization — never a redirect off
   * the deployment.
   */
  readonly platformNormalizedPath?: string;
}

export interface DeploySmokeOptions {
  readonly url: string;
  readonly mode?: DeploySmokeMode;
  readonly dryRun?: boolean;
  readonly retries?: number;
  readonly retryDelayMs?: number;
  readonly requestImpl?: RedirectSmokeRequestImpl;
  readonly sleep?: (delayMs: number) => Promise<void>;
  /**
   * Vercel "Protection Bypass for Automation" secret for the project that
   * owns the deployment. Deployment protection answers every path on an
   * unaliased deployment with 302 -> vercel.com/sso-api, so the immutable
   * artifact can only be probed when each request carries this header. The
   * secret is issued per project: the cockpit one is not the Website one.
   */
  readonly bypassSecret?: string;
}

export interface ParsedDeploySmokeArgs {
  url: string;
  mode: DeploySmokeMode;
  dryRun: boolean;
  retries: number;
  retryDelayMs: number;
}

const WEBSITE_ORIGIN = 'https://threadplane.ai';
const BYPASS_HEADER = 'x-vercel-protection-bypass';
const BYPASS_SECRET_ENV = 'VERCEL_AUTOMATION_BYPASS_SECRET';
const DEFAULT_RETRIES = 0;
const DEFAULT_RETRY_DELAY_MS = 2000;
const ALL_MODES: readonly WorkspaceMode[] = ['Docs', 'Run', 'Code', 'API'];
const ROOT_STREAMING_LEGACY_PATH =
  '/langgraph/core-capabilities/streaming/overview/python';
const defaultSleep = (delayMs: number): Promise<void> =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));

type MappedWorkspaceResolution = Extract<
  WorkspaceResolution,
  { kind: 'mapped' }
>;

const rootResolution = (): MappedWorkspaceResolution => {
  const resolution = resolveLegacyPath(ROOT_STREAMING_LEGACY_PATH);
  if (!resolution || resolution.kind !== 'mapped') {
    throw new Error('Redirect smoke requires the registry streaming route');
  }
  return resolution;
};

const expectedLocation = (
  resolution: WorkspaceResolution,
  rawMode: string | string[] | undefined
): string => {
  const mode = resolveLegacyRequestMode(rawMode, resolution);
  return new URL(
    getCanonicalWebsiteWorkspaceHref(resolution, mode),
    `${WEBSITE_ORIGIN}/`
  ).toString();
};

const redirectCase = (
  name: string,
  path: string,
  resolution: WorkspaceResolution,
  rawMode?: string | string[],
  headers?: Readonly<Record<string, string>>
): RedirectSmokeCase => ({
  name,
  path,
  expectedStatus: 308,
  expectedLocation: expectedLocation(resolution, rawMode),
  ...(headers ? { headers } : {}),
});

const notFoundCase = (
  name: string,
  path: string,
  raw = false
): RedirectSmokeCase => ({
  name,
  path,
  expectedStatus: 404,
  raw,
  ...(raw && path.includes('//')
    ? { platformNormalizedPath: path.replace(/\/{2,}/g, '/') }
    : {}),
});

export const RAW_MALFORMED_REQUEST_TARGETS = [
  `/${ROOT_STREAMING_LEGACY_PATH}`,
  ROOT_STREAMING_LEGACY_PATH.replace(
    '/core-capabilities/',
    '/./core-capabilities/'
  ),
  ROOT_STREAMING_LEGACY_PATH.replace(
    '/core-capabilities/',
    '/../core-capabilities/'
  ),
  ROOT_STREAMING_LEGACY_PATH.replace(
    '/core-capabilities/',
    '/%2e/core-capabilities/'
  ),
  ROOT_STREAMING_LEGACY_PATH.replace(
    '/core-capabilities/',
    '/%2e%2e/core-capabilities/'
  ),
  ROOT_STREAMING_LEGACY_PATH.replace('/overview/', '/%2Foverview/'),
  ROOT_STREAMING_LEGACY_PATH.replace('/overview/', '/%5Coverview/'),
  ROOT_STREAMING_LEGACY_PATH.replace('/overview/', '/\\overview/'),
] as const;

const entryResolution = (
  entry: CockpitManifestEntry
): MappedWorkspaceResolution => {
  const resolution = resolveLegacyPath(entry.legacyPath);
  if (!resolution || resolution.kind !== 'mapped') {
    throw new Error(`Manifest route is not resolvable: ${entry.id}`);
  }
  return resolution;
};

const buildPreviewCases = (): RedirectSmokeCase[] => {
  const cases: RedirectSmokeCase[] = [];
  const root = rootResolution();
  for (const [name, path] of [
    ['root default redirect', '/'],
    ['root Docs ignored', '/?mode=docs'],
    ['root Run redirect', '/?mode=run'],
    ['root Code ignored', '/?mode=code'],
    ['root API ignored', '/?mode=api'],
    ['root invalid mode ignored', '/?mode=invalid'],
    ['root duplicate modes ignored', '/?mode=docs&mode=run'],
    [
      'root unrelated query stripped',
      '/?return_to=https%3A%2F%2Fattacker.test&utm_source=legacy',
    ],
  ] as const) {
    cases.push(redirectCase(name, path, root, 'run'));
  }

  for (const entry of cockpitManifest) {
    const resolution = entryResolution(entry);
    cases.push(
      redirectCase(`${entry.id} missing mode`, entry.legacyPath, resolution)
    );
    for (const mode of entry.availableModes) {
      cases.push(
        redirectCase(
          `${entry.id} available mode ${mode}`,
          `${entry.legacyPath}?mode=${mode.toLowerCase()}`,
          resolution,
          mode.toLowerCase()
        )
      );
    }
    for (const mode of ALL_MODES.filter(
      (candidate) => !entry.availableModes.includes(candidate)
    )) {
      cases.push(
        redirectCase(
          `${entry.id} unavailable mode ${mode}`,
          `${entry.legacyPath}?mode=${mode.toLowerCase()}`,
          resolution,
          mode.toLowerCase()
        )
      );
    }
    cases.push(
      redirectCase(
        `${entry.id} invalid mode`,
        `${entry.legacyPath}?mode=invalid`,
        resolution,
        'invalid'
      ),
      redirectCase(
        `${entry.id} duplicate modes`,
        `${entry.legacyPath}?mode=docs&mode=run`,
        resolution,
        ['docs', 'run']
      ),
      redirectCase(
        `${entry.id} unrelated query stripping`,
        `${entry.legacyPath}?return_to=https%3A%2F%2Fattacker.test&utm_source=legacy`,
        resolution
      )
    );
  }

  const workspaceOnly = cockpitManifest.find((entry) =>
    getWorkspaceDestinationPath(entry).startsWith('/workspace/')
  );
  if (!workspaceOnly)
    throw new Error('Expected a workspace-only manifest entry');
  cases.push(
    redirectCase(
      'workspace Docs serialization',
      `${workspaceOnly.legacyPath}?mode=docs`,
      entryResolution(workspaceOnly),
      'docs'
    )
  );

  cases.push(
    notFoundCase('unknown path 404', '/unknown'),
    notFoundCase('partial path 404', '/langgraph/core-capabilities/streaming'),
    notFoundCase('extra path 404', `${ROOT_STREAMING_LEGACY_PATH}/extra`),
    notFoundCase('trailing slash 404', `${ROOT_STREAMING_LEGACY_PATH}/`),
    redirectCase(
      'hostile forwarding headers ignored',
      ROOT_STREAMING_LEGACY_PATH,
      root,
      undefined,
      {
        forwarded: 'host=attacker.test;proto=http',
        'x-forwarded-host': 'attacker.test',
        'x-forwarded-proto': 'http',
        referer: 'https://attacker.test/redirect',
      }
    ),
    {
      name: 'favicon permanent redirect',
      path: '/favicon.ico',
      expectedStatus: 308,
      expectedLocation: '/icon.svg',
    },
    ...RAW_MALFORMED_REQUEST_TARGETS.map((path, index) =>
      notFoundCase(`raw malformed ${index + 1}: ${path}`, path, true)
    )
  );
  return cases;
};

const buildProductionCases = (): RedirectSmokeCase[] => {
  const root = rootResolution();
  const docsBacked = cockpitManifest.find((entry) =>
    getWorkspaceDestinationPath(entry).startsWith('/docs/')
  );
  const workspaceOnly = cockpitManifest.find((entry) =>
    getWorkspaceDestinationPath(entry).startsWith('/workspace/')
  );
  if (!docsBacked || !workspaceOnly) {
    throw new Error(
      'Redirect smoke requires Docs-backed and workspace-only routes'
    );
  }
  return [
    redirectCase('root production redirect', '/', root, 'run'),
    redirectCase(
      'Docs-backed production redirect',
      docsBacked.legacyPath,
      entryResolution(docsBacked)
    ),
    redirectCase(
      'workspace-only production redirect',
      workspaceOnly.legacyPath,
      entryResolution(workspaceOnly)
    ),
    notFoundCase('unknown production 404', '/unknown'),
    {
      name: 'favicon production redirect',
      path: '/favicon.ico',
      expectedStatus: 308,
      expectedLocation: '/icon.svg',
    },
    ...RAW_MALFORMED_REQUEST_TARGETS.slice(0, 3).map((path, index) =>
      notFoundCase(
        `raw malformed production canary ${index + 1}: ${path}`,
        path,
        true
      )
    ),
  ];
};

export const buildRedirectSmokeCases = (
  mode: DeploySmokeMode
): RedirectSmokeCase[] =>
  mode === 'preview' ? buildPreviewCases() : buildProductionCases();

export const parseDeploySmokeArgs = (argv: string[]): ParsedDeploySmokeArgs => {
  const options: ParsedDeploySmokeArgs = {
    url: 'http://127.0.0.1:3000',
    mode: 'preview',
    dryRun: false,
    retries: DEFAULT_RETRIES,
    retryDelayMs: DEFAULT_RETRY_DELAY_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];
    if (current === '--url' && next) {
      options.url = next;
      index += 1;
    } else if (current === '--mode' && next) {
      if (next !== 'preview' && next !== 'production') {
        throw new Error('--mode must be preview or production');
      }
      options.mode = next;
      index += 1;
    } else if (current === '--dry-run') {
      options.dryRun = true;
    } else if (current === '--retries' && next) {
      options.retries = Number(next);
      index += 1;
    } else if (current === '--retry-delay-ms' && next) {
      options.retryDelayMs = Number(next);
      index += 1;
    }
  }
  return options;
};

export const requestExactTarget: RedirectSmokeRequestImpl = ({
  origin,
  path,
  headers,
}) =>
  new Promise((resolvePromise, reject) => {
    const target = new URL(origin);
    const requester =
      target.protocol === 'https:' ? https.request : http.request;
    const request = requester(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        method: 'GET',
        path,
        headers,
      },
      (response) => {
        response.resume();
        response.on('end', () => {
          const normalizedHeaders = Object.fromEntries(
            Object.entries(response.headers).map(([key, value]) => [
              key.toLowerCase(),
              Array.isArray(value) ? value.join(', ') : value,
            ])
          );
          resolvePromise({
            status: response.statusCode ?? 0,
            headers: normalizedHeaders,
          });
        });
      }
    );
    request.on('error', reject);
    request.end();
  });

class RedirectContractError extends Error {}

const isPlatformNormalization = (
  origin: string,
  smokeCase: RedirectSmokeCase,
  response: RedirectSmokeResponse
): boolean => {
  const location = response.headers.location;
  if (
    smokeCase.platformNormalizedPath === undefined ||
    response.status !== 308 ||
    location === undefined
  ) {
    return false;
  }
  // The platform answers with a relative Location; resolve both sides
  // against the deployment origin so only that exact same-origin target
  // passes.
  let resolved: string;
  try {
    resolved = new URL(location, `${origin}/`).toString();
  } catch {
    return false;
  }
  return (
    resolved ===
    new URL(smokeCase.platformNormalizedPath, `${origin}/`).toString()
  );
};

const verifyCase = (
  mode: DeploySmokeMode,
  origin: string,
  smokeCase: RedirectSmokeCase,
  response: RedirectSmokeResponse
): void => {
  const rawGateHint = smokeCase.raw
    ? ' Raw-path rejection failed; verify the 404 route in vercel.cockpit.json still precedes framework routing before promotion.'
    : '';
  if (isPlatformNormalization(origin, smokeCase, response)) return;
  if (response.status !== smokeCase.expectedStatus) {
    const protectionHint =
      response.status === 302 &&
      (response.headers.location ?? '').startsWith(
        'https://vercel.com/sso-api'
      )
        ? ` The deployment answered with Vercel deployment protection, not the redirect service; supply the owning project's automation bypass secret via ${BYPASS_SECRET_ENV}.`
        : '';
    throw new RedirectContractError(
      `[${mode}] ${smokeCase.name}: expected ${smokeCase.expectedStatus}, received ${response.status}.${rawGateHint}${protectionHint}`
    );
  }
  const location = response.headers.location;
  if (smokeCase.expectedLocation !== undefined) {
    if (location !== smokeCase.expectedLocation) {
      throw new RedirectContractError(
        `[${mode}] ${smokeCase.name}: expected Location ${
          smokeCase.expectedLocation
        }, received ${location ?? '<missing>'}.${rawGateHint}`
      );
    }
  } else if (location !== undefined) {
    throw new RedirectContractError(
      `[${mode}] ${smokeCase.name}: expected no Location, received ${location}.${rawGateHint}`
    );
  }
};

export const runDeploySmoke = async ({
  url,
  mode = 'preview',
  dryRun = false,
  retries = DEFAULT_RETRIES,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  requestImpl = requestExactTarget,
  sleep = defaultSleep,
  bypassSecret,
}: DeploySmokeOptions): Promise<string> => {
  const target = new URL(url);
  if (target.pathname !== '/' || target.search || target.hash) {
    throw new Error('Deploy smoke --url must be an absolute origin');
  }
  const origin = target.origin;
  const cases = buildRedirectSmokeCases(mode);
  if (dryRun) return `dry-run:${mode}:${origin}:${cases.length}`;

  const bypassHeaders: Readonly<Record<string, string>> | undefined =
    bypassSecret ? { [BYPASS_HEADER]: bypassSecret } : undefined;

  for (const smokeCase of cases) {
    const headers =
      smokeCase.headers || bypassHeaders
        ? { ...smokeCase.headers, ...bypassHeaders }
        : undefined;
    let attempt = 0;
    while (true) {
      try {
        const response = await requestImpl({
          origin,
          path: smokeCase.path,
          ...(headers ? { headers } : {}),
        });
        verifyCase(mode, origin, smokeCase, response);
        break;
      } catch (error: unknown) {
        if (error instanceof RedirectContractError) throw error;
        if (attempt >= retries) {
          const message =
            error instanceof Error ? error.message : String(error);
          throw new Error(
            `[${mode}] ${smokeCase.name}: transport failed: ${message}`
          );
        }
        attempt += 1;
        await sleep(retryDelayMs);
      }
    }
  }
  return `pass:${mode}:${origin}:${cases.length}`;
};

if (
  process.argv[1] ===
  resolve(process.cwd(), 'apps/cockpit/scripts/deploy-smoke.ts')
) {
  try {
    const options = parseDeploySmokeArgs(process.argv.slice(2));
    // Read the secret from the environment, never argv, so it stays out of
    // process listings and CI step logs.
    const bypassSecret = process.env[BYPASS_SECRET_ENV] || undefined;
    runDeploySmoke({ ...options, ...(bypassSecret ? { bypassSecret } : {}) })
      .then((result) => process.stdout.write(`${result}\n`))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${message}\n`);
        process.exitCode = 1;
      });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
