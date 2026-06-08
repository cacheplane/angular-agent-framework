import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { generateAgUiDeployment } from './generate-ag-ui-deployment-config';

const REPO_ROOT = resolve(__dirname, '..');

describe('generateAgUiDeployment', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'ag-ui-deploy-'));
  });

  it('stages each ag-ui python tree under deps/<topic>/', () => {
    generateAgUiDeployment({ repoRoot: REPO_ROOT, outDir });
    expect(statSync(join(outDir, 'deps/interrupts/src/graph.py')).isFile()).toBe(true);
    expect(statSync(join(outDir, 'deps/streaming/src/graph.py')).isFile()).toBe(true);
  });

  it('writes server.py with GENERATED header and one endpoint per topic', () => {
    generateAgUiDeployment({ repoRoot: REPO_ROOT, outDir });
    const server = readFileSync(join(outDir, 'server.py'), 'utf8');
    expect(server).toMatch(/^# GENERATED/);
    expect(server).toContain('from deps.interrupts.src.graph import graph as interrupts_graph');
    expect(server).toContain('from deps.streaming.src.graph import graph as streaming_graph');
    expect(server).toContain('path="/agent/interrupts"');
    expect(server).toContain('path="/agent/streaming"');
    expect(server).toContain('@app.get("/ok")');
  });

  it('emits valid Python module names for hyphenated topics (deps dir + import underscored, URL path hyphenated)', () => {
    // Regression: topics like `tool-views`/`json-render` are URL slugs with
    // hyphens, which are illegal in Python module paths. The generator must
    // stage them under an underscored deps dir and import them with
    // underscores, while keeping the hyphenated `/agent/<topic>` route. A
    // hyphen in a `from deps.<...>` line is a SyntaxError and breaks the
    // whole server (which is what shipped before this fix).
    generateAgUiDeployment({ repoRoot: REPO_ROOT, outDir });
    const server = readFileSync(join(outDir, 'server.py'), 'utf8');
    expect(server).toContain('from deps.json_render.src.graph import graph as json_render_graph');
    expect(server).toContain('from deps.tool_views.src.graph import graph as tool_views_graph');
    expect(server).toContain('path="/agent/json-render"');
    expect(server).toContain('path="/agent/tool-views"');
    expect(server).toContain('LangGraphAgent(name="json-render"');
    // No hyphen may ever appear inside a `from deps.<module>` import path.
    for (const line of server.split('\n').filter((l) => l.startsWith('from deps.'))) {
      const modulePath = line.slice('from deps.'.length).split(' ')[0];
      expect(modulePath).not.toContain('-');
    }
    // The underscored deps dir must exist for the import to resolve.
    expect(statSync(join(outDir, 'deps/json_render/src/graph.py')).isFile()).toBe(true);
    expect(statSync(join(outDir, 'deps/tool_views/src/graph.py')).isFile()).toBe(true);
  });

  it('server.py enforces X-Internal-Token on /agent/*', () => {
    generateAgUiDeployment({ repoRoot: REPO_ROOT, outDir });
    const server = readFileSync(join(outDir, 'server.py'), 'utf8');
    expect(server).toContain('AG_UI_INTERNAL_TOKEN');
    expect(server).toContain('x-internal-token');
    expect(server).toMatch(/if request\.url\.path == "\/ok":\s*\n\s*return await call_next\(request\)/);
  });

  it('writes requirements.txt with GENERATED header and union of example deps', () => {
    generateAgUiDeployment({ repoRoot: REPO_ROOT, outDir });
    const reqs = readFileSync(join(outDir, 'requirements.txt'), 'utf8');
    expect(reqs).toMatch(/^# GENERATED/);
    expect(reqs).toContain('ag-ui-langgraph==');
    expect(reqs).toContain('fastapi==');
    expect(reqs).toContain('uvicorn==');
    expect(reqs).not.toMatch(/^-e \./m);
  });

  it('produces byte-identical output across runs (idempotent)', () => {
    generateAgUiDeployment({ repoRoot: REPO_ROOT, outDir });
    const firstServer = readFileSync(join(outDir, 'server.py'), 'utf8');
    const firstReqs = readFileSync(join(outDir, 'requirements.txt'), 'utf8');
    generateAgUiDeployment({ repoRoot: REPO_ROOT, outDir });
    expect(readFileSync(join(outDir, 'server.py'), 'utf8')).toBe(firstServer);
    expect(readFileSync(join(outDir, 'requirements.txt'), 'utf8')).toBe(firstReqs);
  });
});
