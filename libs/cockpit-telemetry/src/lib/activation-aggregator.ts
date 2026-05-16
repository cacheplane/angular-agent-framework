// SPDX-License-Identifier: MIT
import { Injectable, inject } from '@angular/core';
import posthog from 'posthog-js';
import { COCKPIT_TELEMETRY_CONFIG } from './tokens';

const WINDOW_MS = 30 * 60 * 1000;

export type ActivationSignal =
  | 'transport_connected'
  | 'chat_first_message'
  | 'thread_persisted'
  | 'interrupt_handled'
  | 'generative_component_rendered';

@Injectable()
export class ActivationAggregator {
  private config = inject(COCKPIT_TELEMETRY_CONFIG);
  private windowStartAt: number | null = null;
  private seen = new Set<ActivationSignal>();
  private complete = false;

  markSignal(signal: ActivationSignal): void {
    if (this.complete) return;
    const now = Date.now();
    // If first signal of window, anchor; if outside window, reset.
    if (this.windowStartAt === null || now - this.windowStartAt > WINDOW_MS) {
      this.windowStartAt = now;
      this.seen.clear();
    }
    this.seen.add(signal);
    if (this.seen.size === 5) {
      this.complete = true;
      const durationMs = now - this.windowStartAt;
      try {
        posthog.capture('cockpit:activation_complete', {
          capability: this.config.capabilitySlug,
          duration_ms: durationMs,
        });
      } catch {
        // silent fail
      }
    }
  }
}
