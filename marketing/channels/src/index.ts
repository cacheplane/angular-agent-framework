// SPDX-License-Identifier: MIT
//
// @ngaf/marketing-channels — Channel adapters for X, LinkedIn, Dev.to, Reddit.
// Skeleton only. Implementations land in the channel-adapters sub-spec.

export type ChannelId = 'x' | 'linkedin' | 'devto' | 'reddit';

export interface Draft {
  channel: ChannelId;
  text: string;
  media?: { png: Buffer; alt: string }[];
  threadParts?: string[];
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

export function getAdapter(_id: ChannelId): ChannelAdapter {
  throw new Error(
    '@ngaf/marketing-channels: getAdapter() not yet implemented. See channel-adapters sub-spec.',
  );
}
