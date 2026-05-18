// SPDX-License-Identifier: MIT
//
// @ngaf/marketing-channels — public API.
// See docs/superpowers/specs/marketing/2026-05-17-channel-adapters-design.md

export type {
  Draft,
  DraftMedia,
  PostResult,
  PostMetrics,
  ChannelAdapter,
  ChannelId,
} from './types';

export { validateDraft, ValidationError } from './validation';

export { getAdapter } from './registry';
