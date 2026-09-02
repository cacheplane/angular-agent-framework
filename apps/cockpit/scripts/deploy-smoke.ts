import { resolve } from 'node:path';
import {
  cockpitManifest,
  getWorkspaceDestinationPath,
} from '@threadplane/cockpit-registry';

export interface DeploySmokeOptions {
  url: string;
  websiteUrl?: string;
  expectedTitle?: string;
  dryRun?: boolean;
  retries?: number;
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (delayMs: number) => Promise<void>;
}

export type ParsedDeploySmokeArgs = DeploySmokeOptions;

const DEFAULT_EXPECTED_TITLE = 'Cockpit';
const DEFAULT_RETRIES = 0;
const DEFAULT_RETRY_DELAY_MS = 2000;
const defaultSleep = (delayMs: number): Promise<void> =>
  new Promise((resolvePromise) => {
    setTimeout(resolvePromise, delayMs);
  });

export const getRegistryWebsiteDestinations = (): string[] =>
  [
    ...new Set(
      cockpitManifest
        .filter((entry) => entry.availableModes.length > 0)
        .map(getWorkspaceDestinationPath)
    ),
  ].sort();

export const getRedirectDisabledProbePath = (): string => {
  const streaming = cockpitManifest.find(
    (entry) => entry.product === 'langgraph' && entry.topic === 'streaming'
  );
  if (!streaming) {
    throw new Error(
      'Deploy smoke requires the registry-owned LangGraph streaming route'
    );
  }
  return streaming.legacyPath;
};

export const parseDeploySmokeArgs = (argv: string[]): ParsedDeploySmokeArgs => {
  const options: ParsedDeploySmokeArgs = {
    url: 'http://127.0.0.1:3000',
    expectedTitle: DEFAULT_EXPECTED_TITLE,
    dryRun: false,
    retries: DEFAULT_RETRIES,
    retryDelayMs: DEFAULT_RETRY_DELAY_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === '--url' && argv[index + 1]) {
      options.url = argv[index + 1];
      index += 1;
      continue;
    }

    if (current === '--expected-title' && argv[index + 1]) {
      options.expectedTitle = argv[index + 1];
      index += 1;
      continue;
    }

    if (current === '--website-url' && argv[index + 1]) {
      options.websiteUrl = argv[index + 1];
      index += 1;
      continue;
    }

    if (current === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (current === '--retries' && argv[index + 1]) {
      options.retries = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (current === '--retry-delay-ms' && argv[index + 1]) {
      options.retryDelayMs = Number(argv[index + 1]);
      index += 1;
    }
  }

  return options;
};

export const runDeploySmoke = async ({
  url,
  websiteUrl,
  expectedTitle = DEFAULT_EXPECTED_TITLE,
  dryRun = false,
  retries = DEFAULT_RETRIES,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  fetchImpl = fetch,
  sleep = defaultSleep,
}: DeploySmokeOptions): Promise<string> => {
  if (dryRun) {
    return `dry-run:${url}:${expectedTitle}`;
  }

  let attemptsRemaining = retries + 1;
  let lastError: Error | null = null;

  while (attemptsRemaining > 0) {
    try {
      const response = await fetchImpl(url);

      if (!response.ok) {
        throw new Error(`Deploy smoke failed for ${url}: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();

      if (!html.includes(expectedTitle)) {
        throw new Error(`Deploy smoke failed for ${url}: missing title ${expectedTitle}`);
      }

      if (websiteUrl) {
        const destinations = getRegistryWebsiteDestinations();
        for (const destination of destinations) {
          const destinationUrl = new URL(destination, websiteUrl).toString();
          const destinationResponse = await fetchImpl(destinationUrl);
          if (!destinationResponse.ok) {
            throw new Error(
              `Deploy smoke failed for ${destinationUrl}: ${destinationResponse.status} ${destinationResponse.statusText}`
            );
          }
        }

        const redirectProbeUrl = new URL(
          getRedirectDisabledProbePath(),
          url
        ).toString();
        const redirectProbeResponse = await fetchImpl(redirectProbeUrl, {
          redirect: 'manual',
        });
        if (
          !redirectProbeResponse.ok ||
          (redirectProbeResponse.status >= 300 &&
            redirectProbeResponse.status < 400)
        ) {
          throw new Error(
            `Deploy smoke failed for ${redirectProbeUrl}: legacy redirects must remain disabled before activation`
          );
        }

        return `pass:${url}:${expectedTitle}:website:${destinations.length}:redirects-off`;
      }

      return `pass:${url}:${expectedTitle}`;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attemptsRemaining -= 1;

      if (attemptsRemaining === 0) {
        throw lastError;
      }

      await sleep(retryDelayMs);
    }
  }

  throw lastError ?? new Error(`Deploy smoke failed for ${url}`);
};

if (process.argv[1] === resolve(process.cwd(), 'apps/cockpit/scripts/deploy-smoke.ts')) {
  const options = parseDeploySmokeArgs(process.argv.slice(2));

  runDeploySmoke(options)
    .then((result) => {
      process.stdout.write(`${result}\n`);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
