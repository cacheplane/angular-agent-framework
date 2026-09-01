// SPDX-License-Identifier: MIT
// AG-UI HTTP/SSE hosting service for Mastra agents (Lane B).
//
// Upstream @ag-ui/mastra ships NO plain AG-UI HTTP endpoint — only the
// in-process `MastraAgent` bridge and a mount for its own chat frontend
// runtime. This hand-written service is the missing piece: it subscribes to
// `MastraAgent.run(input)` (the raw AG-UI event Observable) and encodes each
// event as an SSE `data: {json}` frame — exactly what @ag-ui/client's
// HttpAgent consumes, and exactly what the Python lane's FastAPI bridges
// emit for the other runtimes.
//
// Behavior contract mirrors deployments/ag-ui-dev/server.py:
// - `GET /ok` is unauthenticated (health checks).
// - Every other route requires `X-Internal-Token` === AG_UI_INTERNAL_TOKEN,
//   else a clean `401 {"detail":"unauthorized"}`.
// - Topics are served at `POST /agent/<topic>`.
// - An Observable error becomes a RUN_ERROR frame on the stream, not a
//   dropped socket.
import http from 'node:http';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MastraAgent } from '@ag-ui/mastra';
import { createMastra } from './agents.mjs';

const AG_UI_INTERNAL_TOKEN = process.env.AG_UI_INTERNAL_TOKEN;
if (!AG_UI_INTERNAL_TOKEN) {
  // Same boot contract as ag-ui-dev's `os.environ["AG_UI_INTERNAL_TOKEN"]`:
  // refuse to start unauthenticated rather than serve an open OpenAI proxy.
  console.error('AG_UI_INTERNAL_TOKEN is not set; refusing to start.');
  process.exit(1);
}

// Suspend/resume snapshots and agent memory live in LibSQL file storage.
// On Railway this path MUST be on a mounted volume (e.g. /data) or resume
// breaks across restarts/redeploys — see README.md.
const DB_PATH = resolve(
  process.env.AG_UI_MASTRA_DB_PATH ?? new URL('./data/mastra.db', import.meta.url).pathname,
);
mkdirSync(dirname(DB_PATH), { recursive: true });

const mastra = createMastra(`file:${DB_PATH}`);

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** One SSE frame per AG-UI event — the wire shape @ag-ui/client parses. */
function sseFrame(event) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function createAgUiServer() {
  return http.createServer(async (req, res) => {
    const path = (req.url ?? '').split('?')[0];

    if (req.method === 'GET' && path === '/ok') {
      json(res, 200, { ok: true });
      return;
    }

    if (req.headers['x-internal-token'] !== AG_UI_INTERNAL_TOKEN) {
      json(res, 401, { detail: 'unauthorized' });
      return;
    }

    const match = /^\/agent\/([a-z0-9_-]+)$/.exec(path);
    if (!match || req.method !== 'POST') {
      json(res, 404, { detail: 'not found' });
      return;
    }

    const topic = match[1];
    let agent;
    try {
      agent = mastra.getAgent(topic);
    } catch {
      agent = undefined;
    }
    if (!agent) {
      json(res, 404, { detail: `no such topic: ${topic}` });
      return;
    }

    let body = '';
    for await (const chunk of req) body += chunk;
    let input;
    try {
      input = JSON.parse(body);
    } catch {
      json(res, 400, { detail: 'invalid JSON body' });
      return;
    }

    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });

    // A fresh bridge per request: MastraAgent carries per-run state.
    // resourceId scopes Mastra memory (threads live under a resource);
    // keying it by AG-UI threadId gives per-conversation memory.
    const bridge = new MastraAgent({
      agentId: topic,
      agent,
      resourceId: input.threadId,
    });

    const sub = bridge.run(input).subscribe({
      next: (event) => {
        res.write(sseFrame(event));
      },
      error: (err) => {
        // Map failures into the protocol instead of killing the socket:
        // the client finalizes the run as an error rather than hanging.
        res.write(
          sseFrame({ type: 'RUN_ERROR', message: String(err?.message ?? err) }),
        );
        res.end();
      },
      complete: () => {
        res.end();
      },
    });

    req.on('close', () => sub.unsubscribe());
  });
}

// Start listening only when run directly (`node server.mjs`) — tests import
// createAgUiServer() and bind an ephemeral port instead.
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const PORT = process.env.PORT ? Number(process.env.PORT) : 8321;
  createAgUiServer().listen(PORT, () => {
    console.log(`ag-ui-mastra listening on :${PORT} (db: ${DB_PATH})`);
  });
}
