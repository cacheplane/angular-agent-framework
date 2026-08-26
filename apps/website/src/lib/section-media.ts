// SPDX-License-Identifier: MIT
import { HITL_CLIP, LANGGRAPH_CLIP, type DemoClip } from './demo-media';
import type { SolutionCodeBlocks } from './solutions-data';

/**
 * What a homepage section can show. Every medium is optional and that is
 * load-bearing: a section with one medium renders bare, with no tablist, and
 * sections gain tabs as media is produced rather than blocking on a recording
 * that does not exist yet.
 */
export interface SectionMedia {
  video?: DemoClip;
  code?: SolutionCodeBlocks;
  /** Phase 2. Declared now so the switcher's shape does not change later. */
  live?: { prompt: string; mode?: 'embed' | 'popup' | 'sidebar' };
}

export const SECTION_MEDIA: Record<'stream' | 'approve', SectionMedia> = {
  stream: {
    video: LANGGRAPH_CLIP,
    code: [
      {
        label: 'chat.component.ts — headless streaming',
        language: 'typescript',
        source: `export class ChatPageComponent {
  protected readonly agent = injectAgent();

  // Signals, not callbacks: the template re-renders as tokens arrive.
  readonly messages = computed(() => this.agent.messages());
  readonly isLoading = computed(() => this.agent.isLoading());

  send(message: string) {
    this.agent.submit({ message });
  }
}`,
      },
    ],
  },
  approve: {
    video: HITL_CLIP,
    code: [
      {
        label: 'approval.component.ts — the gate',
        language: 'typescript',
        source: `export class ApprovalComponent {
  protected readonly agent = injectAgent(APPROVAL_AGENT);

  // Non-null only while the graph is paused on an interrupt.
  readonly pendingApproval = computed(() => this.agent.interrupt());

  approve() {
    this.agent.submit({ resume: { approved: true } });
  }

  reject(reason: string) {
    this.agent.submit({ resume: { approved: false, reason } });
  }
}`,
      },
    ],
  },
};
