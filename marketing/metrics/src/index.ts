// SPDX-License-Identifier: MIT
//
// @threadplane/marketing-metrics — Metrics ingestion for the marketing pipeline.
// Skeleton only. Implementation lands in the metrics-ingest sub-spec.

export interface RunOptions {
  sinceHours?: number;
}

export interface RunResult {
  posts: number;
  eventsEmitted: number;
}

export function run(_opts?: RunOptions): Promise<RunResult> {
  throw new Error(
    '@threadplane/marketing-metrics: run() not yet implemented. See metrics-ingest sub-spec.',
  );
}
