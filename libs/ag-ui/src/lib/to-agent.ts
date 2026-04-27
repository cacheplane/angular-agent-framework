// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { AbstractAgent } from '@ag-ui/client';
import type { Agent } from '@cacheplane/chat';

export function toAgent(source: AbstractAgent): Agent {
  void source;
  throw new Error('not implemented');
}
