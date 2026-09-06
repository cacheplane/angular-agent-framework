import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { StageBeat } from './stage-beats';

/**
 * Proof lines for the stage rail (spec §4): counts read from the committed
 * recording at build time. Nothing here is typed by hand; a segment whose
 * number cannot be derived is omitted, never estimated. The one phrase that is
 * a property rather than a count is "no generated code ran".
 *
 * Server-only: this module reads the recording with `node:fs`, so it must be
 * imported from the server page and never from a `'use client'` file.
 */
interface RecordedRun {
  beat: string;
  action: { kind: string; checkpointIndex?: number };
  events: { event: unknown }[];
}

interface Recording {
  runs: RecordedRun[];
  histories: { afterRun: number; states: unknown[] }[];
}

type Msg = {
  type?: string;
  name?: string;
  content?: unknown;
  additional_kwargs?: { citations?: unknown };
};

type Dict = Record<string, unknown>;

function messagesOf(run: RecordedRun): Msg[] {
  const out: Msg[] = [];
  for (const { event } of run.events) {
    const ev = event as Dict;
    const lists = [
      ev['messages'],
      (ev['data'] as Dict | undefined)?.['messages'],
      ev['data'],
    ];
    for (const l of lists) {
      if (Array.isArray(l)) {
        out.push(...(l.filter((m) => m && typeof m === 'object') as Msg[]));
      }
    }
  }
  return out;
}

function toolResult(run: RecordedRun, name: string): unknown {
  const m = messagesOf(run)
    .filter((x) => x.type === 'tool' && x.name === name)
    .at(-1);
  if (!m || typeof m.content !== 'string') return undefined;
  try {
    return JSON.parse(m.content);
  } catch {
    return undefined;
  }
}

function toolCallNames(run: RecordedRun): Set<string> {
  const names = new Set<string>();
  for (const m of messagesOf(run)) {
    if (!Array.isArray(m.content)) continue;
    for (const part of m.content as { type?: string; name?: string }[]) {
      if (part?.type === 'function_call' && part.name) names.add(part.name);
    }
  }
  return names;
}

/**
 * The Sources badge counts `additional_kwargs.citations` on the final AI
 * message of the run's last state, so the proof line counts the same array.
 */
function citationCount(run: RecordedRun): number | null {
  const last = run.events
    .map(({ event }) => event as Dict)
    .filter((ev) => ev['type'] === 'values')
    .at(-1);
  const messages = (last?.['data'] as Dict | undefined)?.['messages'];
  if (!Array.isArray(messages)) return null;
  const ai = (messages as Msg[]).filter((m) => m?.type === 'ai').at(-1);
  const citations = ai?.additional_kwargs?.citations;
  return Array.isArray(citations) ? citations.length : null;
}

function countKey(o: unknown, key: string): number {
  if (Array.isArray(o)) return o.reduce((n, v) => n + countKey(v, key), 0);
  if (o && typeof o === 'object') {
    return Object.entries(o).reduce(
      (n, [k, v]) => n + (k === key ? 1 : 0) + countKey(v, key),
      0
    );
  }
  return 0;
}

const join = (parts: (string | null)[]) =>
  parts.filter((p): p is string => p !== null).join(' · ');
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const counted = (n: number | null, w: string) => (n ? plural(n, w) : null);

export function deriveStageProof(rec: Recording): Record<StageBeat, string> {
  const run = (beat: string, kind: string): RecordedRun | undefined =>
    rec.runs.find((r) => r.beat === beat && r.action.kind === kind);
  const histAfter = (i: number): number | null =>
    rec.histories.filter((h) => h.afterRun === i).at(-1)?.states.length ?? null;

  const r0 = run('stream', 'submit');
  const stream = join([
    counted(r0?.events.length ?? 0, 'event'),
    counted(r0 ? toolCallNames(r0).size : 0, 'tool call'),
    counted(r0 ? citationCount(r0) : null, 'source'),
  ]);

  const reload = rec.runs.some((r) => r.action.kind === 'reload');
  const forkIdx = rec.runs.findIndex(
    (r) => r.action.checkpointIndex !== undefined
  );
  const fork = forkIdx >= 0 ? rec.runs[forkIdx] : undefined;
  const checkpoints = fork ? histAfter(forkIdx + 1) : null;
  // history() is newest-first: index i of n is step n - i.
  const forkStep =
    fork && checkpoints ? checkpoints - (fork.action.checkpointIndex ?? 0) : 0;
  const persist = join([
    reload ? 'reloaded' : null,
    counted(checkpoints, 'checkpoint'),
    forkStep > 0 ? `forked at step ${forkStep}` : null,
  ]);

  const r4 = run('approve', 'submit');
  const interrupted =
    r4?.events.some(({ event }) => {
      const ev = event as Dict;
      return (
        Array.isArray(ev['__interrupt__']) ||
        Array.isArray((ev['data'] as Dict | undefined)?.['__interrupt__'])
      );
    }) ?? false;
  const r4i = r4 ? rec.runs.indexOf(r4) : -1;
  const last = r4 ? histAfter(r4i) ?? histAfter(r4i + 1) : null;
  const approve = join([
    interrupted ? '1 interrupt pending' : null,
    last ? `checkpoint ${last} of ${last}` : null,
  ]);

  const r6 = run('render', 'submit');
  const surface = r6 ? toolResult(r6, 'render_a2ui_surface') : undefined;
  const surfaces = Array.isArray(surface)
    ? countKey(surface, 'createSurface')
    : 0;
  const components = Array.isArray(surface)
    ? countKey(surface, 'component')
    : 0;
  const render = join([
    counted(surfaces, 'surface'),
    counted(components, 'component'),
    'no generated code ran',
  ]);

  return { stream, persist, approve, render };
}

// The cwd differs between `nx build website` (repo root) and
// `cd apps/website && vitest`; the two candidates cover both.
const RECORDING_CANDIDATES = [
  resolve(process.cwd(), 'examples/chat/angular/public/stage-replay.json'),
  resolve(
    process.cwd(),
    '../../examples/chat/angular/public/stage-replay.json'
  ),
];

function readRecording(): Recording {
  for (const p of RECORDING_CANDIDATES) {
    try {
      return JSON.parse(readFileSync(p, 'utf8')) as Recording;
    } catch {
      /* next candidate */
    }
  }
  throw new Error(
    'stage-replay.json not found; the website build reads the demo recording for the stage proof lines'
  );
}

export const STAGE_PROOF: Record<StageBeat, string> = deriveStageProof(
  readRecording()
);
