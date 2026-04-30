// SPDX-License-Identifier: MIT
import type { AngularRegistry } from '@cacheplane/render';

export interface ChatConfig {
  registry?: AngularRegistry;
}

export type MessageTemplateType = 'human' | 'ai' | 'tool' | 'system' | 'function';
