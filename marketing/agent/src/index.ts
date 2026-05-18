// SPDX-License-Identifier: MIT
//
// @ngaf/marketing-agent — LangGraph drafting agent for the marketing pipeline.
// Skeleton only. Implementation lands in the content-agent sub-spec.

import type { Draft } from '@ngaf/marketing-channels';

export type Trigger =
  | { kind: 'blog-merge'; slug: string }
  | { kind: 'release'; tag: string }
  | { kind: 'cowork-prompt'; topic: string; freeform?: string }
  | { kind: 'cadence'; window: 'weekly' };

export interface DraftBundle {
  id: string;
  trigger: Trigger;
  drafts: Draft[];
  source: { url?: string; title?: string; excerpt?: string };
  createdAt: string;
}

export function draft(_trigger: Trigger): Promise<DraftBundle> {
  throw new Error(
    '@ngaf/marketing-agent: draft() not yet implemented. See content-agent sub-spec.',
  );
}
