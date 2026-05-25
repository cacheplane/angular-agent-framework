// SPDX-License-Identifier: MIT
import type { RenderEvent } from '@threadplane/render';

export interface ChatRenderEvent {
  readonly messageIndex: number;
  readonly surfaceId?: string;
  readonly event: RenderEvent;
}
