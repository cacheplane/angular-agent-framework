import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('./client', () => ({
  captureEvent: vi.fn().mockResolvedValue(undefined),
}));

import { captureEvent } from './client';
import {
  captureRuntimeInstanceCreated,
  captureStreamStarted,
  captureStreamEnded,
  captureStreamErrored,
} from './adapter';


describe('adapter helpers', () => {
  beforeEach(() => vi.mocked(captureEvent).mockClear());

  test('captureRuntimeInstanceCreated drops any apiKey property without sending a derivative', async () => {
    await captureRuntimeInstanceCreated({
      transport: 'langgraph',
      provider: 'openai',
      apiKey: 'secret-token-xyz',
    });
    const call = vi.mocked(captureEvent).mock.calls[0];
    expect(call[0]).toBe('ngaf:runtime_instance_created');
    expect((call[1] as Record<string, unknown>).apiKey).toBeUndefined();  // raw key stripped
    expect((call[1] as Record<string, unknown>).apiKey_sha256).toBeUndefined();
  });

  test('captureStreamStarted records provider + model only', async () => {
    await captureStreamStarted({ provider: 'openai', model: 'gpt-4' });
    expect(captureEvent).toHaveBeenCalledWith(
      'ngaf:stream_started',
      expect.objectContaining({ provider: 'openai', model: 'gpt-4' }),
    );
  });

  test('captureStreamEnded records duration', async () => {
    await captureStreamEnded({ provider: 'openai', model: 'gpt-4', durationMs: 1234 });
    expect(captureEvent).toHaveBeenCalledWith(
      'ngaf:stream_ended',
      expect.objectContaining({ durationMs: 1234 }),
    );
  });

  test('captureStreamErrored records error.class only — no message', async () => {
    await captureStreamErrored({
      provider: 'openai',
      model: 'gpt-4',
      error: new TypeError('detailed error with PII xxxx'),
    });
    const props = vi.mocked(captureEvent).mock.calls[0][1] as Record<string, unknown>;
    expect(props.errorClass).toBe('TypeError');
    expect(props.errorMessage).toBeUndefined();
    expect(JSON.stringify(props)).not.toMatch(/detailed error/);
  });

  test('all helpers no-op silently when captureEvent rejects', async () => {
    vi.mocked(captureEvent).mockRejectedValueOnce(new Error('network'));
    await expect(captureStreamStarted({ provider: 'x', model: 'y' })).resolves.toBeUndefined();
  });
});
