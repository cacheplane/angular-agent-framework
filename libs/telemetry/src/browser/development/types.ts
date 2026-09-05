export type DevelopmentIntegration = 'langgraph' | 'ag-ui' | 'render';
export type DevelopmentMilestone =
  | 'transport.connected'
  | 'runtime.first_stream_completed'
  | 'thread.persisted'
  | 'interrupt.handled'
  | 'generative_ui.rendered';
export interface DevelopmentRuntimeOptions {
  integration: DevelopmentIntegration;
  packageName:
    | '@threadplane/langgraph'
    | '@threadplane/ag-ui'
    | '@threadplane/render';
  packageVersion: string;
  /** Opaque package-local correlation, never identity or authorization. */
  installationToken?: string | null;
  enabled?: () => boolean;
}
export interface DevelopmentRuntime {
  touch(): void;
  milestone(kind: DevelopmentMilestone, durationMs?: number): void;
  dispose(): void;
}
export interface RuntimeOwner {
  options: DevelopmentRuntimeOptions;
  allowed(): boolean;
}
export interface RuntimeEvent {
  installationToken?: string;
  eventId: string;
  kind: 'runtime.session_started' | DevelopmentMilestone;
  occurredAt: string;
  collectorVersion: '1';
  subject: {
    id: string;
    namespace: 'development_browser';
    scope: 'persistent' | 'memory';
  };
  sessionId: string;
  properties: Record<string, string>;
}
export const MILESTONES: readonly DevelopmentMilestone[] = [
  'transport.connected',
  'runtime.first_stream_completed',
  'thread.persisted',
  'interrupt.handled',
  'generative_ui.rendered',
];
export const MAX_AGE = 24 * 60 * 60 * 1000;
export const SESSION_IDLE = 30 * 60 * 1000;
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
