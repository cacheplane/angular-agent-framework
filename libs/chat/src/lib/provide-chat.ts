// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import type { ChatConfig } from './chat.types';

export const CHAT_CONFIG = new InjectionToken<ChatConfig>('CHAT_CONFIG');

export function provideChat(config: ChatConfig) {
  return makeEnvironmentProviders([
    { provide: CHAT_CONFIG, useValue: config },
  ]);
}
