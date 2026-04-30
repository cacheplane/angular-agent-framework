// SPDX-License-Identifier: MIT
import type { RenderEvent } from '@cacheplane/render';

export interface ChatRenderEvent {
  readonly messageIndex: number;
  readonly surfaceId?: string;
  readonly event: RenderEvent;
}
