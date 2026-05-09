#!/usr/bin/env node
// SPDX-License-Identifier: MIT
/**
 * Captures the streaming chunk sequence produced by the LangGraph
 * SDK for a real `gpt-5 + reasoning.effort=high` run against the
 * canonical examples/chat backend. The output JSON is the ground-
 * truth fixture for stream-manager.bridge.spec.ts:
 *   - Each entry is a `messages` event payload (an array of message
 *     tuples) — exactly what the bridge sees per chunk.
 *
 * Run instructions (from repo root):
 *   1. Ensure OPENAI_API_KEY is in examples/chat/python/.env
 *   2. Start backend:
 *        cd examples/chat/python && uv run langgraph dev --port 2024 --no-browser
 *   3. In another terminal, run:
 *        node libs/langgraph/test/fixtures/capture-streaming-reasoning-puzzle.mjs
 *   4. Output is written to libs/langgraph/test/fixtures/streaming-reasoning-puzzle.json
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from '@langchain/langgraph-sdk';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(SCRIPT_DIR, 'streaming-reasoning-puzzle.json');
const API_URL = process.env.LANGGRAPH_URL || 'http://localhost:2024';
const ASSISTANT_ID = process.env.LANGGRAPH_ASSISTANT_ID || 'chat';

const PROMPT =
  'Three friends start with 14 apples. They share them so each gets ' +
  'a different prime number of apples and one gets exactly twice as ' +
  'many as another. How many does each get? Walk through your ' +
  'reasoning step by step.';

async function main() {
  const client = new Client({ apiUrl: API_URL });

  const ok = await fetch(`${API_URL}/ok`).then(r => r.ok).catch(() => false);
  if (!ok) {
    console.error(`Backend not reachable at ${API_URL}/ok — is langgraph dev running?`);
    process.exit(1);
  }

  const thread = await client.threads.create();
  console.error(`thread=${thread.thread_id}`);

  const events = [];
  let chunkCount = 0;
  for await (const event of client.runs.stream(thread.thread_id, ASSISTANT_ID, {
    input: {
      messages: [{ role: 'user', content: PROMPT }],
      model: 'gpt-5',
      reasoning_effort: 'high',
    },
    streamMode: ['messages-tuple', 'values'],
  })) {
    chunkCount += 1;
    events.push({ event: event.event, data: event.data });
    if (event.event === 'messages') {
      const tuples = Array.isArray(event.data) ? event.data : [];
      const lastMsg = tuples.length ? tuples[tuples.length - 1] : null;
      const len =
        lastMsg && Array.isArray(lastMsg) && lastMsg[0] && typeof lastMsg[0].content === 'string'
          ? lastMsg[0].content.length
          : '?';
      process.stderr.write(`  chunk #${chunkCount} (messages, len=${len})\n`);
    }
  }

  const state = await client.threads.getState(thread.thread_id);
  const finalAi = (state.values?.messages || []).filter(m => m.type === 'ai').pop();
  const finalContent = finalAi?.content;
  const canonicalText = Array.isArray(finalContent)
    ? finalContent
        .filter(b => b && (b.type === 'text' || b.type === 'output_text'))
        .map(b => b.text)
        .filter(t => typeof t === 'string')
        .join('')
    : typeof finalContent === 'string'
      ? finalContent
      : '';

  const out = {
    thread_id: thread.thread_id,
    canonical_text_length: canonicalText.length,
    canonical_text: canonicalText,
    events,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.error(`\n✓ wrote ${OUT}`);
  console.error(`  events: ${events.length}, canonical_text_length: ${canonicalText.length}`);
}

main().catch(err => {
  console.error('capture failed:', err);
  process.exit(1);
});
