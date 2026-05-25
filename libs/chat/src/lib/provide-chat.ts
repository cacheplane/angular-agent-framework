// SPDX-License-Identifier: MIT
import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import {
  runLicenseCheck,
  LICENSE_PUBLIC_KEY,
  inferNoncommercial,
} from '@threadplane/licensing';
import type { AngularRegistry } from '@threadplane/render';

const PACKAGE_NAME = '@threadplane/chat';

export interface ChatConfig {
  /** Shared render registry for consumers that read CHAT_CONFIG. */
  renderRegistry?: AngularRegistry;
  /** Shared AI avatar label for consumers that read CHAT_CONFIG (default: "A"). */
  avatarLabel?: string;
  /** Shared assistant display name for consumers that read CHAT_CONFIG (default: "Assistant"). */
  assistantName?: string;
  /** Signed license token from threadplane.ai. Optional; omitted in dev. */
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
    token: config.license,
    publicKey: config.__licensePublicKey ?? LICENSE_PUBLIC_KEY,
    isNoncommercial:
      config.__licenseEnvHint?.isNoncommercial ?? inferNoncommercial(),
  });

  return makeEnvironmentProviders([
    { provide: CHAT_CONFIG, useValue: config },
  ]);
}
