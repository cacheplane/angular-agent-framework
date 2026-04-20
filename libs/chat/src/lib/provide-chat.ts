// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import {
  runLicenseCheck,
  LICENSE_PUBLIC_KEY,
  inferNoncommercial,
} from '@cacheplane/licensing';
import type { AngularRegistry } from '@cacheplane/render';

const PACKAGE_NAME = '@cacheplane/chat';
declare const __CACHEPLANE_CHAT_VERSION__: string | undefined;
const PACKAGE_VERSION =
  typeof __CACHEPLANE_CHAT_VERSION__ !== 'undefined'
    ? __CACHEPLANE_CHAT_VERSION__
    : '0.0.0-dev';
const TELEMETRY_ENDPOINT = 'https://telemetry.cacheplane.dev/v1/ping';

export interface ChatConfig {
  /** Default render registry for generative UI components. */
  renderRegistry?: AngularRegistry;
  /** Override the default AI avatar label (default: "A"). */
  avatarLabel?: string;
  /** Override the default assistant display name (default: "Assistant"). */
  assistantName?: string;
  /** Signed license token from cacheplane.dev. Optional; omitted in dev. */
  license?: string;
  /**
   * @internal
   * Test-only env hint override. Not part of the stable API.
   */
  __licenseEnvHint?: { isNoncommercial: boolean };
  /**
   * @internal
   * Test-only public-key override. Defaults to the compile-time embedded
   * `LICENSE_PUBLIC_KEY`. Not part of the stable API.
   */
  __licensePublicKey?: Uint8Array;
}

export const CHAT_CONFIG = new InjectionToken<ChatConfig>('CHAT_CONFIG');

export function provideChat(config: ChatConfig) {
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
    { provide: CHAT_CONFIG, useValue: config },
  ]);
}
