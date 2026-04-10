// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { RenderEvent } from '@cacheplane/render';

export interface ChatRenderEvent {
  readonly messageIndex: number;
  readonly surfaceId?: string;
  readonly event: RenderEvent;
}
