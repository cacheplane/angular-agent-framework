// SPDX-License-Identifier: MIT
// Structural fixture differ. Never a gate by itself: the @drift spec results
// are the gate; this explains a red run. Compares tool names, response kind,
// and a coarse length bucket — deliberately NOT byte equality and NOT meaning.

export interface FixtureEntry {
  match: Record<string, unknown>;
  response: Record<string, unknown>;
}

export interface EntrySummary {
  key: string;
  kind: 'text' | 'toolCalls';
  toolNames: string[];
  /** floor(log10(JSON length)) — order-of-magnitude only. */
  lengthBucket: number;
  /** True when the response is empty text with no tool calls — the aimock
   * recorder emits this ("fixture may be incomplete") when it cannot parse
   * tool-call deltas out of a stream. A recorder artifact, not drift. */
  incomplete: boolean;
}

export interface DriftReport {
  changed: Array<{ key: string; reason: string; committed: EntrySummary; recorded: EntrySummary }>;
  unmatchedCommitted: string[];
  unmatchedRecorded: string[];
  /** Recorded entries the recorder itself marked as possibly incomplete
   * (empty content, no tool calls). Compared against nothing. */
  incompleteRecordings: string[];
}

function entryKey(e: FixtureEntry): string {
  const m = e.match ?? {};
  return [m['userMessage'] ?? '', m['toolName'] ?? '', m['hasToolResult'] ? 'tr' : '']
    .join('|');
}

export function summarizeEntry(e: FixtureEntry): EntrySummary {
  const toolCalls = e.response?.['toolCalls'];
  const names = Array.isArray(toolCalls)
    ? toolCalls
        .map((t) => (t && typeof t === 'object' ? String((t as Record<string, unknown>)['name'] ?? '') : ''))
        .filter(Boolean)
        .sort()
    : [];
  const content = e.response?.['content'];
  return {
    key: entryKey(e),
    kind: names.length > 0 ? 'toolCalls' : 'text',
    toolNames: names,
    lengthBucket: Math.floor(Math.log10(Math.max(1, JSON.stringify(e.response ?? {}).length))),
    incomplete: names.length === 0 && (content === '' || content === undefined),
  };
}

export function diffFixtures(committed: FixtureEntry[], recorded: FixtureEntry[]): DriftReport {
  const byKey = (list: FixtureEntry[]) => new Map(list.map((e) => [entryKey(e), summarizeEntry(e)]));
  const c = byKey(committed);
  const r = byKey(recorded);
  const report: DriftReport = { changed: [], unmatchedCommitted: [], unmatchedRecorded: [], incompleteRecordings: [] };
  for (const [key, cs] of c) {
    const rs = r.get(key);
    if (!rs) { report.unmatchedCommitted.push(key); continue; }
    if (rs.incomplete) { report.incompleteRecordings.push(key); continue; }
    const reasons: string[] = [];
    if (cs.kind !== rs.kind) reasons.push(`kind: ${cs.kind} -> ${rs.kind}`);
    if (cs.toolNames.join(',') !== rs.toolNames.join(',')) reasons.push(`toolNames: [${cs.toolNames}] -> [${rs.toolNames}]`);
    if (cs.lengthBucket !== rs.lengthBucket) reasons.push(`lengthBucket: ${cs.lengthBucket} -> ${rs.lengthBucket}`);
    if (reasons.length) report.changed.push({ key, reason: reasons.join('; '), committed: cs, recorded: rs });
  }
  for (const key of r.keys()) if (!c.has(key)) report.unmatchedRecorded.push(key);
  return report;
}
