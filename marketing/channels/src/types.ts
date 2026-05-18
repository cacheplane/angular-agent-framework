// SPDX-License-Identifier: MIT
//
// @ngaf/marketing-channels — public types.

export type ChannelId = 'x' | 'linkedin' | 'devto' | 'reddit';

export interface DraftMedia {
  png: Buffer;
  alt: string;
}

export interface Draft {
  channel: ChannelId;
  text?: string;
  threadParts?: string[];
  media?: DraftMedia[];
  link?: { url: string; previewTitle?: string };
  scheduledAt?: string;
}

export interface PostResult {
  channel: ChannelId;
  postId: string;
  url: string;
  postedAt: string;
}

export interface PostMetrics {
  postId: string;
  impressions?: number;
  clicks?: number;
  replies?: number;
  shares?: number;
  fetchedAt: string;
}

export interface ChannelAdapter {
  readonly id: ChannelId;
  post(draft: Draft): Promise<PostResult>;
  metrics(postId: string): Promise<PostMetrics>;
}
