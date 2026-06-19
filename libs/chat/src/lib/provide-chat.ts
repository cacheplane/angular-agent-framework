// SPDX-License-Identifier: MIT
import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import {
  runLicenseCheck,
  LICENSE_PUBLIC_KEY,
  inferNoncommercial,
} from '@threadplane/licensing';
import type { AngularRegistry } from '@threadplane/render';

const PACKAGE_NAME = '@threadplane/chat';

/**
 * Application-wide options for {@link provideChat}. Every field is optional;
 * the values are exposed to all chat components in the tree via the
 * `CHAT_CONFIG` injection token, so you set them once at bootstrap instead of
 * threading props through every component.
 */
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

/**
 * Bootstrap `@threadplane/chat` in an Angular application or standalone
 * component tree.
 *
 * Call this once inside `bootstrapApplication` (or the `providers` array of a
 * root `ApplicationConfig`). It registers the shared {@link ChatConfig} token
 * so every chat component in the tree can read the render registry, avatar
 * label, and assistant display name without explicit prop threading.
 *
 * A license check is fired asynchronously on every call (it never throws; a
 * watermark is shown in non-commercial builds when no valid token is supplied).
 *
 * @param config Options bag that controls the chat feature set:
 *   - `renderRegistry` — shared {@link AngularRegistry} wiring tool-view
 *     components to their names; pass the value returned by
 *     `defineAngularRegistry` from `\@threadplane/render`.
 *   - `avatarLabel` — short label shown in the AI avatar bubble (default `"A"`).
 *   - `assistantName` — display name shown above assistant messages
 *     (default `"Assistant"`).
 *   - `license` — signed token from threadplane.ai; omit in development.
 * @returns An `EnvironmentProviders` value suitable for the `providers` array
 *   of `bootstrapApplication` or `ApplicationConfig`.
 * @example
 * ```ts
 * // main.ts
 * import { bootstrapApplication } from '@angular/platform-browser';
 * import { provideChat } from '@threadplane/chat';
 * import { defineAngularRegistry, provideRender } from '@threadplane/render';
 * import { DayCardComponent } from './day-card.component';
 *
 * const registry = defineAngularRegistry({ day_card: DayCardComponent });
 *
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideChat({ renderRegistry: registry, avatarLabel: 'AI' }),
 *     provideRender({ registry }),
 *   ],
 * });
 * ```
 */
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
