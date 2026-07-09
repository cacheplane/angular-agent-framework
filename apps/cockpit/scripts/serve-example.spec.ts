import { describe, expect, it } from 'vitest';
import { backendCommand, COCKPIT_RUNTIME_ENV, formatAllModeSummary } from './serve-example';
import { capabilities, findCapability, type Capability } from './capability-registry';

describe('backendCommand', () => {
  it('uses uvicorn on the registry pythonPort for ag-ui caps', () => {
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
      id: 'x', product: 'render', topic: 'x', angularProject: 'cockpit-render-x-angular', port: 4499,
    };
    expect(backendCommand(noPy)).toBeNull();
  });

  it('exposes an empty runtime base URL so the cockpit iframe targets localhost', () => {
    expect(COCKPIT_RUNTIME_ENV).toEqual({ NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL: '' });
  });

  it('formats the all-mode startup summary from the registry count', () => {
    expect(formatAllModeSummary()).toBe(`\nStarting cockpit + all ${capabilities.length} examples\n`);
    expect(formatAllModeSummary()).not.toContain('14 examples');
  });
});
