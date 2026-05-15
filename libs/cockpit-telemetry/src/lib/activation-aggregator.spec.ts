// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivationAggregator } from './activation-aggregator';
import { COCKPIT_TELEMETRY_CONFIG } from './tokens';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn() },
}));

import posthog from 'posthog-js';

describe('ActivationAggregator', () => {
  let aggregator: ActivationAggregator;

  beforeEach(() => {
    vi.mocked(posthog.capture).mockClear();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: COCKPIT_TELEMETRY_CONFIG,
          useValue: { posthogKey: 'k', distinctId: 'd', capabilitySlug: 'streaming' },
        },
        ActivationAggregator,
      ],
    });
    aggregator = TestBed.inject(ActivationAggregator);
  });

  test('does not fire activation_complete before all 5 signals', () => {
    aggregator.markSignal('chat_first_message');
    aggregator.markSignal('transport_connected');
    aggregator.markSignal('thread_persisted');
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  test('fires activation_complete exactly once when all 5 signals seen', () => {
    aggregator.markSignal('chat_first_message');
    aggregator.markSignal('transport_connected');
    aggregator.markSignal('thread_persisted');
    aggregator.markSignal('interrupt_handled');
    aggregator.markSignal('generative_component_rendered');
    expect(posthog.capture).toHaveBeenCalledTimes(1);
    expect(posthog.capture).toHaveBeenCalledWith(
      'cockpit:activation_complete',
      expect.any(Object),
    );
  });

  test('subsequent signals after complete do not re-fire', () => {
    for (const sig of [
      'chat_first_message',
      'transport_connected',
      'thread_persisted',
      'interrupt_handled',
      'generative_component_rendered',
    ] as const) {
      aggregator.markSignal(sig);
    }
    aggregator.markSignal('chat_first_message');
    expect(posthog.capture).toHaveBeenCalledTimes(1);
  });

  test('duplicate signals are idempotent', () => {
    aggregator.markSignal('chat_first_message');
    aggregator.markSignal('chat_first_message');
    aggregator.markSignal('transport_connected');
    aggregator.markSignal('transport_connected');
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  test('30-min window: stale first signal resets when newer one arrives outside window', () => {
    const real = Date.now;
    let now = 1_000_000;
    Date.now = () => now;
    try {
      aggregator.markSignal('chat_first_message');
      now += 31 * 60 * 1000; // 31 min later
      aggregator.markSignal('transport_connected');
      // chat_first_message has expired; only transport_connected is in the current window
      now += 1000;
      aggregator.markSignal('thread_persisted');
      aggregator.markSignal('interrupt_handled');
      aggregator.markSignal('generative_component_rendered');
      // Need chat_first_message in this window too
      expect(posthog.capture).not.toHaveBeenCalled();
      aggregator.markSignal('chat_first_message');
      expect(posthog.capture).toHaveBeenCalled();
    } finally {
      Date.now = real;
    }
  });

  test('emits duration_ms property when activation_complete fires', () => {
    const real = Date.now;
    let now = 5_000_000;
    Date.now = () => now;
    try {
      aggregator.markSignal('chat_first_message');
      now += 1234;
      aggregator.markSignal('transport_connected');
      aggregator.markSignal('thread_persisted');
      aggregator.markSignal('interrupt_handled');
      aggregator.markSignal('generative_component_rendered');
      const call = vi.mocked(posthog.capture).mock.calls[0];
      expect((call[1] as Record<string, unknown>)['duration_ms']).toBe(1234);
      expect((call[1] as Record<string, unknown>)['capability']).toBe('streaming');
    } finally {
      Date.now = real;
    }
  });
});
