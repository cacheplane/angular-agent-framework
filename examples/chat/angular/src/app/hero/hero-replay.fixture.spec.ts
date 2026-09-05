/// <reference types="node" />
// The app build type-checks src/**/*.ts with `types: []`; this spec is the one
// file that reads from disk, so it pulls in the node globals it needs itself.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateHeroRecording } from './hero-recording.types';

const FIXTURE = resolve(__dirname, '../../../public/hero-replay.json');

describe('hero-replay.json', () => {
  const rec = validateHeroRecording(JSON.parse(readFileSync(FIXTURE, 'utf8')));
  it('has the prompt, resume and genui runs in order', () => {
    expect(rec.runs.slice(0, 3).map((r) => r.label)).toEqual(['prompt', 'resume', 'genui']);
  });
  it('the prompt run pauses on an interrupt', () => {
    expect(JSON.stringify(rec.runs[0].events)).toMatch(/approval_request/);
  });
  it('the prompt run lists the inventory and pauses inside delete_backups, not request_approval', () => {
    const prompt = JSON.stringify(rec.runs[0].events);
    expect(prompt).toMatch(/"name":\s*"list_backups"/);
    expect(prompt).toMatch(/"name":\s*"delete_backups"/);
    expect(prompt).not.toMatch(/"name":\s*"request_approval"/);
  });
  it('the resume run executes the deletion and answers compactly', () => {
    const finalValues = rec.runs[1].events.filter((e) => (e.event as { type?: string }).type === 'values').at(-1);
    const messages = ((finalValues?.event as { messages?: { type?: string; content?: unknown; tool_calls?: unknown[] }[] })?.messages ?? []);
    // The ToolMessage carries delete_backups' JSON audit: the rows really went.
    const audit = [...messages].reverse().find((m) => m.type === 'tool');
    const parsed = JSON.parse(String(audit?.content ?? '{}')) as { deleted?: unknown };
    expect(Array.isArray(parsed.deleted) && parsed.deleted.length > 0).toBe(true);
    // The whole point of the change: the answer is executed, then summarised.
    // 1,400 chars is the ceiling the measurement gate accepted; see the spec.
    const last = [...messages].reverse().find((m) => m.type === 'ai' && !(m.tool_calls && m.tool_calls.length));
    const text = typeof last?.content === 'string'
      ? last.content
      : (last?.content as { type?: string; text?: string }[] | undefined)?.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('') ?? '';
    expect(text.length).toBeGreaterThan(0);
    expect(text.length).toBeLessThan(1400);
  });
  it('the genui run carries an A2UI payload', () => {
    expect(JSON.stringify(rec.runs[2].events)).toMatch(/a2ui/i);
  });
  it('never contains an API key or bearer token', () => {
    expect(JSON.stringify(rec)).not.toMatch(/sk-[A-Za-z0-9]{10,}|Bearer /);
  });
});
