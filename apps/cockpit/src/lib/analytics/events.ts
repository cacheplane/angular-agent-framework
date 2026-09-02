// SPDX-License-Identifier: MIT
import type {
  RuntimePhase,
  RuntimeTerminalPhase,
} from '@threadplane/workspace-react';

export type CockpitShellEvent =
  | 'cockpit:recipe_opened'
  | 'cockpit:mode_switched'
  | 'cockpit:code_copied'
  | 'cockpit:runtime_action'
  | 'cockpit:runtime_status_changed';

export type CockpitLegacyEvent =
  | 'cockpit:recipe_opened'
  | 'cockpit:mode_switched'
  | 'cockpit:code_copied';

export interface CockpitNavigationProps {
  capability?: string;
  category?: string;
  from_capability?: string;
  from_mode?: 'run' | 'code' | 'docs' | 'api';
  to_mode?: 'run' | 'code' | 'docs' | 'api';
  surface?: 'code_mode' | 'docs_code_snippet' | 'agentic_prompt';
  file_path?: string;
}

interface CockpitRuntimeActionBase {
  capability: string;
  state_before: RuntimePhase;
}

export type CockpitRuntimeActionProps = CockpitRuntimeActionBase &
  (
    | { action: 'recheck' | 'reload'; outcome: 'requested' }
    | { action: 'open'; outcome: 'requested' | 'failed' }
    | {
        action: 'copy_diagnostics';
        outcome: 'succeeded' | 'failed';
      }
  );

interface CockpitRuntimeStatusChangedBase {
  capability: string;
  elapsed_ms?: number;
}

export type CockpitRuntimeStatusChangedProps = CockpitRuntimeStatusChangedBase &
  (
    | {
        from_state: 'unresponsive' | 'error';
        to_state: 'ready';
        transition: 'recovered';
        reason_code?: never;
      }
    | {
        from_state: Exclude<RuntimePhase, 'unresponsive' | 'error'>;
        to_state: 'ready';
        transition?: never;
        reason_code?: never;
      }
    | {
        from_state: RuntimePhase;
        to_state: 'unresponsive';
        transition?: never;
        reason_code?: never;
      }
    | {
        from_state: RuntimePhase;
        to_state: 'error';
        transition?: never;
        reason_code?: 'bootstrap_failed';
      }
    | {
        from_state: RuntimePhase;
        to_state: 'invalid_configuration';
        transition?: never;
        reason_code?: 'invalid_runtime_url';
      }
  );

export interface CockpitShellEventPropsMap {
  'cockpit:recipe_opened': CockpitNavigationProps;
  'cockpit:mode_switched': CockpitNavigationProps;
  'cockpit:code_copied': CockpitNavigationProps;
  'cockpit:runtime_action': CockpitRuntimeActionProps;
  'cockpit:runtime_status_changed': CockpitRuntimeStatusChangedProps;
}

interface CockpitRuntimeStatusPropertyBag {
  from_state: RuntimePhase;
  to_state: RuntimeTerminalPhase;
  transition?: 'recovered';
  elapsed_ms?: number;
  reason_code?: 'bootstrap_failed' | 'invalid_runtime_url';
}

/**
 * Backwards-compatible client property bag. Operational call sites use the
 * required, event-specific interfaces above before passing them to `track`.
 */
export type CockpitShellProps = CockpitNavigationProps &
  Partial<CockpitRuntimeActionProps & CockpitRuntimeStatusPropertyBag>;
