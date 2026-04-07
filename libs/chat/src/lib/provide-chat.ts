// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
<<<<<<< HEAD
import type { AngularRegistry } from '@cacheplane/render';

export interface ChatConfig {
  /** Default render registry for generative UI components. */
  renderRegistry?: AngularRegistry;
=======
import type { ViewRegistry } from '@cacheplane/render';

export interface ChatConfig {
  /** View registry for generative UI rendering. */
  views?: ViewRegistry;
>>>>>>> origin/main
  /** Override the default AI avatar label (default: "A"). */
  avatarLabel?: string;
  /** Override the default assistant display name (default: "Assistant"). */
  assistantName?: string;
}

export const CHAT_CONFIG = new InjectionToken<ChatConfig>('CHAT_CONFIG');

export function provideChat(config: ChatConfig) {
  return makeEnvironmentProviders([
    { provide: CHAT_CONFIG, useValue: config },
  ]);
}
