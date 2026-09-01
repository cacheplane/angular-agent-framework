// SPDX-License-Identifier: MIT
import posthog from 'posthog-js';
import type {
  CockpitLegacyEvent,
  CockpitNavigationProps,
  CockpitRuntimeActionProps,
  CockpitRuntimeStatusChangedProps,
  CockpitShellEvent,
  CockpitShellProps,
} from './events';

export function track(
  event: CockpitLegacyEvent,
  props?: CockpitNavigationProps
): void;
export function track(
  event: 'cockpit:runtime_action',
  props: CockpitRuntimeActionProps
): void;
export function track(
  event: 'cockpit:runtime_status_changed',
  props: CockpitRuntimeStatusChangedProps
): void;
export function track(
  event: CockpitShellEvent,
  props: CockpitShellProps = {}
): void {
  try {
    if (
      typeof window !== 'undefined' &&
      (posthog as unknown as { __loaded?: boolean }).__loaded
    ) {
      posthog.capture(event, props);
    }
  } catch {
    // silent fail
  }
}
