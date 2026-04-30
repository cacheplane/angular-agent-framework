// SPDX-License-Identifier: MIT
import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import {
  runLicenseCheck,
  LICENSE_PUBLIC_KEY,
  inferNoncommercial,
} from '@cacheplane/licensing';
import type { RenderConfig } from './render.types';

const PACKAGE_NAME = '@cacheplane/render';
declare const __CACHEPLANE_RENDER_VERSION__: string | undefined;
const PACKAGE_VERSION =
  typeof __CACHEPLANE_RENDER_VERSION__ !== 'undefined'
    ? __CACHEPLANE_RENDER_VERSION__
    : '0.0.0-dev';
const TELEMETRY_ENDPOINT = 'https://telemetry.cacheplane.dev/v1/ping';

export const RENDER_CONFIG = new InjectionToken<RenderConfig>('RENDER_CONFIG');

export function provideRender(config: RenderConfig) {
  void runLicenseCheck({
    package: PACKAGE_NAME,
    version: PACKAGE_VERSION,
    token: config.license,
    publicKey: config.__licensePublicKey ?? LICENSE_PUBLIC_KEY,
    telemetryEndpoint: TELEMETRY_ENDPOINT,
    isNoncommercial:
      config.__licenseEnvHint?.isNoncommercial ?? inferNoncommercial(),
  });

  return makeEnvironmentProviders([
    { provide: RENDER_CONFIG, useValue: config },
  ]);
}
