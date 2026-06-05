import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { capabilities } from '../apps/cockpit/scripts/capability-registry';

const GENERATED_HEADER = '# GENERATED — do not edit. Source: scripts/generate-ag-ui-deployment-config.ts';

export interface GenerateOptions {
  repoRoot: string;
  outDir: string;
}

interface AgUiTopic {
  topic: string;
  pythonDir: string;
}

function collectTopics(): AgUiTopic[] {
  const topics = capabilities
    .filter((c) => c.product === 'ag-ui' && c.pythonDir)
    .map<AgUiTopic>((c) => ({ topic: c.topic, pythonDir: c.pythonDir! }));
  topics.sort((a, b) => a.topic.localeCompare(b.topic));
  if (topics.length === 0) {
    throw new Error('No ag-ui topics with pythonDir found in capability registry');
  }
  return topics;
}

function stageDeps(repoRoot: string, outDir: string, topics: AgUiTopic[]): void {
  const depsDir = resolve(outDir, 'deps');
  rmSync(depsDir, { recursive: true, force: true });
  mkdirSync(depsDir, { recursive: true });
  for (const topic of topics) {
    const src = resolve(repoRoot, topic.pythonDir);
    const dst = resolve(depsDir, topic.topic);
    cpSync(src, dst, {
      recursive: true,
      // Exclude virtualenvs / bytecode, plus repo-metadata files (nx project.json,
      // tsconfig*) that would create cross-tree duplicates if mirrored into deps/.
      filter: (s) => {
        if (s.includes('.venv') || s.includes('__pycache__') || s.endsWith('.pyc')) return false;
        const basename = s.split('/').pop() ?? '';
        if (basename === 'project.json') return false;
        if (basename.startsWith('tsconfig') && basename.endsWith('.json')) return false;
        return true;
      },
    });
  }
}

function buildServerPy(topics: AgUiTopic[]): string {
  const imports = topics
    .map((t) => `from deps.${t.topic}.src.graph import graph as ${t.topic.replace(/-/g, '_')}_graph`)
    .join('\n');
  const mounts = topics
    .map(
      (t) =>
        `add_langgraph_fastapi_endpoint(\n` +
        `    app,\n` +
        `    LangGraphAgent(name="${t.topic}", graph=${t.topic.replace(/-/g, '_')}_graph),\n` +
        `    path="/agent/${t.topic}",\n` +
        `)`,
    )
    .join('\n');
  return `${GENERATED_HEADER}
# Multi-topic AG-UI FastAPI server. Aggregates each cockpit/ag-ui/*/python topic
# at /agent/<topic>. Health route /ok is unauthenticated; /agent/* requires
# X-Internal-Token matching the AG_UI_INTERNAL_TOKEN env var.
import os
from fastapi import FastAPI, Request, HTTPException
from ag_ui_langgraph import add_langgraph_fastapi_endpoint, LangGraphAgent

${imports}

AG_UI_INTERNAL_TOKEN = os.environ["AG_UI_INTERNAL_TOKEN"]

app = FastAPI(title="ag-ui-dev")


@app.middleware("http")
async def require_internal_token(request: Request, call_next):
    if request.url.path == "/ok":
        return await call_next(request)
    if request.headers.get("x-internal-token") != AG_UI_INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="unauthorized")
    return await call_next(request)


@app.get("/ok")
def ok() -> dict:
    return {"ok": True}


${mounts}
`;
}

function buildRequirementsTxt(repoRoot: string, topics: AgUiTopic[]): string {
  const versions = new Map<string, string>();
  for (const topic of topics) {
    const reqPath = resolve(repoRoot, topic.pythonDir, 'requirements.txt');
    const content = readFileSync(reqPath, 'utf8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('-e ')) continue;
      const semi = line.indexOf(';');
      const beforeMarker = semi >= 0 ? line.slice(0, semi).trim() : line;
      const match = beforeMarker.match(/^([A-Za-z0-9_.-]+)==([A-Za-z0-9_.+-]+)$/);
      if (!match) continue;
      const [, name, version] = match;
      const existing = versions.get(name);
      if (!existing || compareVersions(version, existing) > 0) {
        versions.set(name, version);
      }
    }
  }
  const sortedNames = [...versions.keys()].sort();
  const lines = sortedNames.map((n) => `${n}==${versions.get(n)}`);
  return `${GENERATED_HEADER}\n${lines.join('\n')}\n`;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((s) => parseInt(s, 10) || 0);
  const pb = b.split('.').map((s) => parseInt(s, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

export function generateAgUiDeployment(options: GenerateOptions): void {
  const topics = collectTopics();
  mkdirSync(options.outDir, { recursive: true });
  stageDeps(options.repoRoot, options.outDir, topics);
  writeFileSync(resolve(options.outDir, 'server.py'), buildServerPy(topics));
  writeFileSync(resolve(options.outDir, 'requirements.txt'), buildRequirementsTxt(options.repoRoot, topics));
}

if (require.main === module) {
  const repoRoot = resolve(__dirname, '..');
  const outDir = resolve(repoRoot, 'deployments/ag-ui-dev');
  generateAgUiDeployment({ repoRoot, outDir });
  console.log('Generated deployments/ag-ui-dev/{server.py,requirements.txt,deps/}');
}
