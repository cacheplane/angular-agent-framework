// SPDX-License-Identifier: MIT
import { HITL_CLIP, LANGGRAPH_CLIP, RENDER_CLIP, SHIP_CLIP, type DemoClip } from './demo-media';
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
  /**
   * Opens the live demo on a curated scenario via `?featured=`.
   *
   * A KEY into `examples/chat`'s suggestion list, never free text — the demo
   * falls back to its default for an id it does not recognise, so a link can
   * never put arbitrary words inside the demo UI. Renaming a suggestion's id
   * there breaks this link, which is why those ids are explicit rather than
   * derived from labels.
   */
  live?: { featured: string; mode?: 'embed' | 'popup' | 'sidebar' };
}

export const SECTION_MEDIA: Record<'stream' | 'render' | 'ship' | 'approve', SectionMedia> = {
  stream: {
    video: LANGGRAPH_CLIP,
    live: { featured: 'tell-me-about-coral' },
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
  render: {
    video: RENDER_CLIP,
    live: { featured: 'generative-ui-contact-form' },
    code: [
      {
        label: 'dashboard.component.ts — the view catalog',
        language: 'typescript',
        source: `import { ChatComponent, views } from '@threadplane/chat';

// Your components, keyed by the name the agent uses in its spec.
const catalog = views({
  contact_form: ContactFormComponent,
  bar_chart: BarChartComponent,
  kpi_card: KpiCardComponent,
});

// <chat [agent]="agent" [views]="catalog" />
// ChatComponent detects a JSON spec in the AI message and renders it through
// the catalog, mounting partial specs as they stream.`,
      },
    ],
  },
  ship: {
    video: SHIP_CLIP,
    live: { featured: 'tell-me-about-coral' },
    code: [
      {
        label: 'app.config.ts — durable threads',
        language: 'typescript',
        source: `provideAgent(DEMO_AGENT, {
  apiUrl: 'https://your-deployment.langgraph.app',
  // The thread id is the durability boundary. Persist it (URL, storage,
  // your own records) and the conversation survives a reload, a new tab,
  // or a different device — the messages live in the checkpoint, not here.
  threadId: signal(threadIdFromUrl()),
});`,
      },
    ],
  },
  approve: {
    video: HITL_CLIP,
    live: { featured: 'approve-before-a-destructive' },
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
