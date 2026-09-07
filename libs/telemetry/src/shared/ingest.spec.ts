import { describe, expect, it } from 'vitest';
import { parseTelemetryEvent } from './ingest';

describe('public telemetry event parsing', () => {
  it.each([
    'tplane:runtime_instance_created', 'tplane:runtime_request_created',
    'tplane:stream_started', 'tplane:stream_ended', 'tplane:stream_errored',
  ])('accepts %s with its required transport', (event) => {
    expect(parseTelemetryEvent(event, { transport: 'langgraph', surface: 'canonical_demo' }))
      .toEqual({ event, properties: { transport: 'langgraph', surface: 'canonical_demo' } });
    expect(parseTelemetryEvent(event, {})).toBeNull();
  });

  it('requires a surface for chat init but permits a property-free provider event', () => {
    expect(parseTelemetryEvent('tplane:browser_chat_init', {})).toBeNull();
    expect(parseTelemetryEvent('tplane:browser_chat_init', { surface: 'canonical_demo' })).not.toBeNull();
    expect(parseTelemetryEvent('tplane:browser_provided', {})).not.toBeNull();
  });

  it.each(['tplane:made_up', 'tplane:postinstall', 'other', null, 1])('rejects unknown event %s', (event) => {
    expect(parseTelemetryEvent(event, { transport: 'custom' })).toBeNull();
  });

  it.each([null, undefined, 'langgraph', 42, [], new Date(), Object.create({ transport: 'custom' })])(
    'rejects malformed property containers', (properties) => {
      expect(parseTelemetryEvent('tplane:stream_started', properties)).toBeNull();
    },
  );

  it('keeps only bounded primitive metadata, excluding arbitrary and sensitive fields', () => {
    const result = parseTelemetryEvent('tplane:stream_ended', {
      transport: 'custom', surface: 'canonical_demo', requestType: 'submit',
      provider: 'openai', model: 'gpt-4', angularVersion: '22.0.0',
      durationMs: 124, sample_weight: 2, errorClass: 'TypeError',
      '0': 'secret', command: 'secret', body: { secret: true }, token: 'secret',
      apiKey: 'secret', errorMessage: 'secret', arbitrary: true, $set: { email: 'secret' },
      $ip: '1.2.3.4', $process_person_profile: true,
    });
    expect(result?.properties).toEqual({
      transport: 'custom', surface: 'canonical_demo', requestType: 'submit',
      provider: 'openai', model: 'gpt-4', angularVersion: '22.0.0',
      durationMs: 124, sample_weight: 2, errorClass: 'TypeError',
    });
  });

  it.each([
    { transport: 1 }, { transport: '' }, { transport: '  ' },
    { model: { secret: true } }, { provider: ['openai'] },
    { surface: 'x'.repeat(129) }, { errorClass: 'TypeError\nsecret' },
    { durationMs: -1 }, { durationMs: Infinity }, { durationMs: '42' },
    { durationMs: 86_400_001 }, { sample_weight: 0 }, { sample_weight: NaN },
  ])('rejects invalid known metadata without coercion', (properties) => {
    expect(parseTelemetryEvent('tplane:stream_ended', { transport: 'custom', ...properties })).toBeNull();
  });

  it('preserves finite reciprocal weights for sampling rates below one in a million', () => {
    expect(parseTelemetryEvent('tplane:stream_started', { transport: 'custom', sample_weight: 10_000_000 }))
      .toEqual({ event: 'tplane:stream_started', properties: { transport: 'custom', sample_weight: 10_000_000 } });
    expect(parseTelemetryEvent('tplane:stream_started', { transport: 'custom', sample_weight: Infinity })).toBeNull();
  });

  it('does not execute property accessors or throw for hostile runtime inputs', () => {
    const getter = () => { throw new Error('secret'); };
    const properties = Object.defineProperty({ transport: 'custom' }, 'model', { get: getter });
    expect(parseTelemetryEvent('tplane:stream_started', properties)).toBeNull();
    const proxy = new Proxy({}, { getPrototypeOf: getter });
    expect(parseTelemetryEvent('tplane:stream_started', proxy)).toBeNull();
  });
});
