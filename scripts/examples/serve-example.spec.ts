import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { backendCommand, formatAllModeSummary } from './serve-example';
import { capabilities, findCapability, type Capability } from '@threadplane/cockpit-registry';

describe('backendCommand', () => {
  it('uses uvicorn on the registry pythonPort for AG-UI caps', () => {
    const cap = findCapability('ag-ui-streaming')!;
    const cmd = backendCommand(cap)!;
    expect(cmd).toContain('cd cockpit/ag-ui/streaming/python');
    expect(cmd).toContain('uv run uvicorn src.server:app --port 5321');
    expect(cmd).not.toContain('langgraph dev');
    expect(cmd).not.toContain('8123');
  });

  it('uses langgraph dev on the registry pythonPort for langgraph caps', () => {
    const cap = findCapability('streaming')!;
    const cmd = backendCommand(cap)!;
    expect(cmd).toContain('cd cockpit/langgraph/streaming/python');
    expect(cmd).toContain('uv run langgraph dev --port 5300 --no-browser');
    expect(cmd).not.toContain('uvicorn');
    expect(cmd).not.toContain('8123');
  });

  it('uses langgraph dev for chat and render caps too', () => {
    expect(backendCommand(findCapability('c-messages')!)).toContain('langgraph dev --port 5501');
    expect(backendCommand(findCapability('r-spec-rendering')!)).toContain('langgraph dev --port 5401');
  });

  it('returns null when the capability has no pythonDir', () => {
    const noPy: Capability = {
      id: 'x',
      runtimeAdapter: 'none',
      product: 'render',
      topic: 'x',
      angularProject: 'cockpit-render-x-angular',
      port: 4499,
    };
    expect(backendCommand(noPy)).toBeNull();
  });

  it('formats the all-mode startup summary from the registry count', () => {
    expect(formatAllModeSummary()).toBe(`\nStarting all ${capabilities.length} examples\n`);
    expect(formatAllModeSummary()).not.toContain('14 examples');
  });
});

describe('serve-example orchestration', () => {
  it('starts no shell app of its own — only the example and its backend', () => {
    const source = readFileSync(new URL('./serve-example.ts', import.meta.url), 'utf8');
    expect(source).not.toContain('nx serve cockpit');
    expect(source).not.toContain('4201');
  });
});
