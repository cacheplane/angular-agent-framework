// SPDX-License-Identifier: MIT
import posthog from 'posthog-js';
import type { CockpitShellEvent, CockpitShellProps } from './events';

export function track(event: CockpitShellEvent, props: CockpitShellProps = {}): void {
  try {
    if (typeof window !== 'undefined' && (posthog as unknown as { __loaded?: boolean }).__loaded) {
      posthog.capture(event, props);
    }
  } catch {
    // silent fail
  }
}
