// SPDX-License-Identifier: MIT
import type { ChannelAdapter, Draft, PostMetrics, PostResult } from '../types';
import { validateDraft } from '../validation';
import { XAuth } from './auth';
import { postX } from './post';

export class XAdapter implements ChannelAdapter {
  readonly id = 'x' as const;
  private readonly auth: XAuth;

  constructor() {
    this.auth = new XAuth();
  }

  async post(draft: Draft): Promise<PostResult> {
    validateDraft(draft, { adapterId: 'x' });
    return postX(this.auth, draft);
  }

  async metrics(postId: string): Promise<PostMetrics> {
    // X read endpoints unavailable on Free/pay-per-use tier (May 2026).
    // When tier upgrades to Basic+, replace with GET /2/tweets/{id}?tweet.fields=public_metrics.
    return { postId, fetchedAt: new Date().toISOString() };
  }
}
