// SPDX-License-Identifier: MIT
import type { ChannelAdapter, Draft, PostMetrics, PostResult } from '../types';
import { validateDraft } from '../validation';
import { postDevTo } from './post';
import { fetchDevToMetrics } from './metrics';

export class DevToAdapter implements ChannelAdapter {
  readonly id = 'devto' as const;
  private readonly apiKey: string;

  constructor() {
    const key = process.env.DEVTO_API_KEY;
    if (!key || key.length === 0) {
      throw new Error(
        'Dev.to adapter missing env var: DEVTO_API_KEY. Generate one at https://dev.to/settings/extensions and add to .env.',
      );
    }
    this.apiKey = key;
  }

  async post(draft: Draft): Promise<PostResult> {
    validateDraft(draft, { adapterId: 'devto' });
    return postDevTo(this.apiKey, draft);
  }

  async metrics(postId: string): Promise<PostMetrics> {
    return fetchDevToMetrics(this.apiKey, postId);
  }
}
