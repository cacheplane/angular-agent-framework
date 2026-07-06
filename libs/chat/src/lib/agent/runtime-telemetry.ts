// SPDX-License-Identifier: MIT

export type AgentRuntimeTelemetryEvent =
  | 'tplane:runtime_instance_created'
  | 'tplane:runtime_request_created'
  | 'tplane:stream_started'
  | 'tplane:stream_ended'
  | 'tplane:stream_errored';

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
