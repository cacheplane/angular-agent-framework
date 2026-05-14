import { captureEvent } from './client.js';
import { sha256 } from '../shared/hash.js';

export interface RuntimeInstanceTelemetry {
  transport: string;                    // 'langgraph' | 'ag-ui' | 'custom'
  provider?: string;                    // 'openai' | 'anthropic' | ...
  model?: string;
  angularVersion?: string;
  apiKey?: string;                      // hashed before sending
}

export interface StreamTelemetry {
  provider: string;
  model: string;
  durationMs?: number;
}

async function safe(fn: () => Promise<void>): Promise<void> {
  try { await fn(); } catch { /* silent fail */ }
}

export async function captureRuntimeInstanceCreated(input: RuntimeInstanceTelemetry): Promise<void> {
  await safe(async () => {
    const { apiKey, ...rest } = input;
    const props: Record<string, unknown> = { ...rest };
    if (apiKey) props.apiKey_sha256 = await sha256(apiKey);
    await captureEvent('ngaf:runtime_instance_created', props);
  });
}

export async function captureStreamStarted(input: StreamTelemetry): Promise<void> {
  await safe(() => captureEvent('ngaf:stream_started', { ...input }));
}

export async function captureStreamEnded(input: StreamTelemetry): Promise<void> {
  await safe(() => captureEvent('ngaf:stream_ended', { ...input }));
}

export async function captureStreamErrored(
  input: StreamTelemetry & { error: Error | unknown },
): Promise<void> {
  await safe(async () => {
    const { error, ...rest } = input;
    const errorClass = error instanceof Error ? error.constructor.name : 'Unknown';
    await captureEvent('ngaf:stream_errored', { ...rest, errorClass });
  });
}
