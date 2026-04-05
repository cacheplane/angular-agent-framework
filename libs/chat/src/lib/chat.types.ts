// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { AngularRegistry } from '@cacheplane/render';

export interface ChatConfig {
  registry?: AngularRegistry;
}

export type MessageTemplateType = 'human' | 'ai' | 'tool' | 'system' | 'function';
