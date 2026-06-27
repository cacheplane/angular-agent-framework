import { captureEvent } from './client.js';

export interface RuntimeInstanceTelemetry {
  transport: string;                    // 'langgraph' | 'ag-ui' | 'custom'
  provider?: string;                    // 'openai' | 'anthropic' | ...
  model?: string;
  angularVersion?: string;
  apiKey?: string;                      // stripped before sending
}

export interface StreamTelemetry {
  provider: string;
  model: string;
  durationMs?: number;
}

export interface RuntimeRequestTelemetry {
  transport: string;
  requestType: string;
  provider?: string;
  model?: string;
}

async function safe(fn: () => Promise<unknown>): Promise<void> {
  try { await fn(); } catch { /* silent fail */ }
}

export async function captureRuntimeInstanceCreated(input: RuntimeInstanceTelemetry): Promise<void> {
  await safe(async () => {
    const { apiKey, ...rest } = input;
    void apiKey;
    await captureEvent('tplane:runtime_instance_created', { ...rest });
  });
}

export async function captureRuntimeRequestCreated(input: RuntimeRequestTelemetry): Promise<void> {
  await safe(() => captureEvent('tplane:runtime_request_created', { ...input }));
}

export async function captureStreamStarted(input: StreamTelemetry): Promise<void> {
  await safe(() => captureEvent('tplane:stream_started', { ...input }));
}

export async function captureStreamEnded(input: StreamTelemetry): Promise<void> {
  await safe(() => captureEvent('tplane:stream_ended', { ...input }));
}

export async function captureStreamErrored(
  input: StreamTelemetry & { error: Error | unknown },
): Promise<void> {
  await safe(async () => {
    const { error, ...rest } = input;
    const errorClass = error instanceof Error ? error.constructor.name : 'Unknown';
    await captureEvent('tplane:stream_errored', { ...rest, errorClass });
  });
}
