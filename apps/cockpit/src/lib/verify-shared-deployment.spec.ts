import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SMOKE_ASSISTANT_STREAM_TIMEOUT_MS,
  getSmokeAssistantStreamTimeoutMs,
} from '../../../../scripts/verify-shared-deployment';

describe('verify-shared-deployment', () => {
  it('allows the two-pass planning graph more time than single-response smoke assistants', () => {
    expect(getSmokeAssistantStreamTimeoutMs('planning')).toBe(90000);
    expect(getSmokeAssistantStreamTimeoutMs('streaming')).toBe(
      DEFAULT_SMOKE_ASSISTANT_STREAM_TIMEOUT_MS,
    );
  });

  it('allows UI-heavy smoke assistants more time than single-response smoke assistants', () => {
    expect(getSmokeAssistantStreamTimeoutMs('c-generative-ui')).toBe(90000);
    expect(getSmokeAssistantStreamTimeoutMs('c-a2ui')).toBe(90000);
  });
});
