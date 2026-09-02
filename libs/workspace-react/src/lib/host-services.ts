import type { WorkspaceMode } from '@threadplane/cockpit-registry';
import type {
  RuntimePhase,
  RuntimeTerminalTransition,
} from './runtime/runtime-state';

export interface WorkspaceNavigationAnalytics {
  readonly capability: string;
  readonly category: string;
  readonly fromCapability: string;
}

export type TrackNavigation = (event: WorkspaceNavigationAnalytics) => void;

export interface WorkspaceNarrativeAnalytics {
  readonly capability?: string;
  readonly surface: 'docs_code_snippet' | 'agentic_prompt';
}

export type TrackNarrativeAction = (
  event: WorkspaceNarrativeAnalytics
) => void;

export interface WorkspaceModeChangeAnalytics {
  readonly capability: string;
  readonly fromMode: WorkspaceMode;
  readonly toMode: WorkspaceMode;
}

export type TrackModeChange = (event: WorkspaceModeChangeAnalytics) => void;

export type WorkspaceRuntimeActionAnalytics =
  | {
      readonly capability: string;
      readonly action: 'recheck' | 'reload';
      readonly stateBefore: RuntimePhase;
      readonly outcome: 'requested';
    }
  | {
      readonly capability: string;
      readonly action: 'open';
      readonly stateBefore: RuntimePhase;
      readonly outcome: 'requested' | 'failed';
    }
  | {
      readonly capability: string;
      readonly action: 'copy_diagnostics';
      readonly stateBefore: RuntimePhase;
      readonly outcome: 'succeeded' | 'failed';
    };

export type TrackRuntimeAction = (
  event: WorkspaceRuntimeActionAnalytics
) => void;

export type TrackRuntimeTransition = (
  event: RuntimeTerminalTransition
) => void;

export type WorkspaceSessionIdProvider = () => string;

export interface RuntimeFrameTelemetry {
  readonly posthogToken?: string;
  readonly ingestHost?: string;
}
