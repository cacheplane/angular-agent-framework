// SPDX-License-Identifier: MIT

export type AgentRuntimeTelemetryEvent =
  | 'ngaf:runtime_instance_created'
  | 'ngaf:runtime_request_created'
  | 'ngaf:stream_started'
  | 'ngaf:stream_ended'
  | 'ngaf:stream_errored';

export interface AgentRuntimeTelemetryProperties {
  transport: 'langgraph' | 'ag-ui' | 'custom' | string;
  surface?: string;
  requestType?: string;
  provider?: string;
  model?: string;
  durationMs?: number;
  errorClass?: string;
}

export interface AgentRuntimeTelemetryPayload {
  event: AgentRuntimeTelemetryEvent;
  properties: AgentRuntimeTelemetryProperties;
}

export type AgentRuntimeTelemetrySink = (payload: AgentRuntimeTelemetryPayload) => void | Promise<void>;
