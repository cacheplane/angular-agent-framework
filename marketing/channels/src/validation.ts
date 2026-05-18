// SPDX-License-Identifier: MIT
import type { ChannelId, Draft } from './types';

export class ValidationError extends Error {
  public readonly rule: string;
  public readonly field?: string;
  constructor(message: string, opts: { rule: string; field?: string }) {
    super(message);
    this.name = 'ValidationError';
    this.rule = opts.rule;
    this.field = opts.field;
  }
}

const MAX_X_CHARS = 280;
const MAX_X_MEDIA = 4;
const MAX_ALT = 1000;
const MAX_PNG_BYTES = 5 * 1024 * 1024;

function codePointLength(s: string): number {
  // Counts Unicode code points (handles surrogate pairs correctly).
  return [...s].length;
}

function validateX(draft: Draft): void {
  const hasText = typeof draft.text === 'string';
  const hasThread = Array.isArray(draft.threadParts);

  if (hasText && hasThread) {
    throw new ValidationError('Draft cannot have both text and threadParts.', {
      rule: 'exclusive-text-thread',
    });
  }
  if (!hasText && !hasThread) {
    throw new ValidationError('Draft must have either text or threadParts.', {
      rule: 'missing-text-or-thread',
    });
  }

  if (hasText && codePointLength(draft.text!) > MAX_X_CHARS) {
    throw new ValidationError(
      `X text exceeds 280 characters (got ${codePointLength(draft.text!)}).`,
      { rule: 'text-too-long', field: 'text' },
    );
  }

  if (hasThread) {
    if (draft.threadParts!.length < 2) {
      throw new ValidationError('threadParts must contain at least 2 entries.', {
        rule: 'thread-too-short',
        field: 'threadParts',
      });
    }
    for (let i = 0; i < draft.threadParts!.length; i++) {
      const part = draft.threadParts![i];
      if (codePointLength(part) > MAX_X_CHARS) {
        throw new ValidationError(
          `threadParts[${i}] exceeds 280 characters (got ${codePointLength(part)}).`,
          { rule: 'thread-part-too-long', field: `threadParts[${i}]` },
        );
      }
    }
  }

  if (draft.media && draft.media.length > MAX_X_MEDIA) {
    throw new ValidationError(
      `X accepts at most 4 media items per post (got ${draft.media.length}).`,
      { rule: 'too-many-media', field: 'media' },
    );
  }

  for (let i = 0; i < (draft.media?.length ?? 0); i++) {
    const m = draft.media![i];
    if (!m.alt || m.alt.length === 0) {
      throw new ValidationError(`media[${i}] alt text is required.`, {
        rule: 'alt-required',
        field: `media[${i}].alt`,
      });
    }
    if (m.alt.length > MAX_ALT) {
      throw new ValidationError(
        `media[${i}] alt text exceeds 1000 characters (got ${m.alt.length}).`,
        { rule: 'alt-too-long', field: `media[${i}].alt` },
      );
    }
    if (m.png.byteLength > MAX_PNG_BYTES) {
      throw new ValidationError(
        `media[${i}] PNG exceeds 5MB (got ${m.png.byteLength} bytes).`,
        { rule: 'png-too-large', field: `media[${i}].png` },
      );
    }
  }
}

export function validateDraft(
  draft: Draft,
  opts: { adapterId?: ChannelId } = {},
): void {
  if (opts.adapterId && opts.adapterId !== draft.channel) {
    throw new ValidationError(
      `Channel mismatch: adapter is "${opts.adapterId}" but draft.channel is "${draft.channel}".`,
      { rule: 'channel-mismatch', field: 'channel' },
    );
  }
  switch (draft.channel) {
    case 'x':
      return validateX(draft);
    case 'linkedin':
    case 'devto':
    case 'reddit':
      throw new ValidationError(
        `Channel "${draft.channel}" adapter is not yet implemented.`,
        { rule: 'not-implemented', field: 'channel' },
      );
    default: {
      const _exhaustive: never = draft.channel;
      throw new ValidationError(`Unknown channel: ${String(_exhaustive)}.`, {
        rule: 'unknown-channel',
        field: 'channel',
      });
    }
  }
}
