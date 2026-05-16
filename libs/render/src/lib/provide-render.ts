// SPDX-License-Identifier: MIT
import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import {
  runLicenseCheck,
  LICENSE_PUBLIC_KEY,
  inferNoncommercial,
} from '@ngaf/licensing';
import type { RenderConfig } from './render.types';
import { RENDER_LIFECYCLE } from './lifecycle';
import { RenderLifecycleService } from './render-lifecycle.service';

const PACKAGE_NAME = '@ngaf/render';

export const RENDER_CONFIG = new InjectionToken<RenderConfig>('RENDER_CONFIG');

export function provideRender(config: RenderConfig) {
  void runLicenseCheck({
    package: PACKAGE_NAME,
    token: config.license,
    publicKey: config.__licensePublicKey ?? LICENSE_PUBLIC_KEY,
    isNoncommercial:
      config.__licenseEnvHint?.isNoncommercial ?? inferNoncommercial(),
  });

  return makeEnvironmentProviders([
    { provide: RENDER_CONFIG, useValue: config },
    RenderLifecycleService,
    { provide: RENDER_LIFECYCLE, useExisting: RenderLifecycleService },
  ]);
}
