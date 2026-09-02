import {
  getCanonicalWebsiteWorkspaceHref,
  resolveLegacyPath,
  resolveLegacyRequestMode,
  type WorkspaceResolution,
} from '@threadplane/cockpit-registry';

const ROOT_STREAMING_LEGACY_PATH =
  '/langgraph/core-capabilities/streaming/overview/python';

export interface CockpitRedirectEnvironment {
  readonly COCKPIT_WEBSITE_ORIGIN?: string;
  readonly NODE_ENV?: string;
}

export function getCockpitWebsiteOrigin(
  environment: CockpitRedirectEnvironment = process.env
): string {
  const rawOrigin = environment.COCKPIT_WEBSITE_ORIGIN;

  if (!rawOrigin) {
    throw new Error('COCKPIT_WEBSITE_ORIGIN must be configured');
  }

  let url: URL;
  try {
    url = new URL(rawOrigin);
  } catch {
    throw new Error('COCKPIT_WEBSITE_ORIGIN must be a valid absolute origin');
  }

  const hasCanonicalOriginForm =
    rawOrigin === url.origin || rawOrigin === `${url.origin}/`;
  const hasOnlyOrigin =
    !url.username &&
    !url.password &&
    url.pathname === '/' &&
    !url.search &&
    !url.hash;
  const canonicalWebsiteOrigin = url.origin === 'https://threadplane.ai';
  const developmentLocalhost =
    environment.NODE_ENV === 'development' &&
    url.protocol === 'http:' &&
    url.hostname === 'localhost';

  if (
    !hasCanonicalOriginForm ||
    !hasOnlyOrigin ||
    (!canonicalWebsiteOrigin && !developmentLocalhost)
  ) {
    throw new Error(
      'COCKPIT_WEBSITE_ORIGIN must be https://threadplane.ai, or HTTP localhost in development'
    );
  }

  return url.origin;
}

const normalizeRequestedMode = (
  modeValues: readonly string[]
): string | string[] | undefined => {
  if (modeValues.length === 0) return undefined;
  return modeValues.length === 1 ? modeValues[0] : [...modeValues];
};

const toWebsiteRedirect = (
  resolution: WorkspaceResolution,
  modeValues: readonly string[],
  environment: CockpitRedirectEnvironment
): string => {
  const mode = resolveLegacyRequestMode(
    normalizeRequestedMode(modeValues),
    resolution
  );
  const href = getCanonicalWebsiteWorkspaceHref(resolution, mode);
  return new URL(href, `${getCockpitWebsiteOrigin(environment)}/`).toString();
};

export function getLegacyWebsiteRedirect(
  legacyPath: string,
  modeValues: readonly string[],
  environment: CockpitRedirectEnvironment = process.env
): string | null {
  const resolution = resolveLegacyPath(legacyPath);
  return resolution
    ? toWebsiteRedirect(resolution, modeValues, environment)
    : null;
}

export function getRootWebsiteRedirect(
  environment: CockpitRedirectEnvironment = process.env
): string {
  const resolution = resolveLegacyPath(ROOT_STREAMING_LEGACY_PATH);
  if (!resolution) {
    throw new Error('The Cockpit root streaming capability is not registered');
  }
  return toWebsiteRedirect(resolution, ['run'], environment);
}
