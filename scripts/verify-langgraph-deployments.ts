#!/usr/bin/env npx tsx
/**
 * Verify all LangGraph Cloud deployments are healthy and can process messages.
 *
 * Usage:
 *   npx tsx scripts/verify-langgraph-deployments.ts
 *   npx tsx scripts/verify-langgraph-deployments.ts --capability streaming
 *   npx tsx scripts/verify-langgraph-deployments.ts --smoke
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const urls: Record<string, string> = JSON.parse(
  readFileSync(resolve(__dirname, '../deployment-urls.json'), 'utf-8'),
);

const capability = process.argv.find((a) => a === '--capability')
  ? process.argv[process.argv.indexOf('--capability') + 1]
  : null;

const smoke = process.argv.includes('--smoke');

const apiKey = process.env['LANGSMITH_API_KEY'] ?? '';
const authHeaders: Record<string, string> = apiKey
  ? { 'x-api-key': apiKey }
  : {};

const entries = capability
  ? [[capability, urls[capability]] as const]
  : Object.entries(urls);

async function main() {
let passed = 0;
let failed = 0;

for (const [name, url] of entries) {
  if (!url || url === 'PENDING_DEPLOYMENT') {
    console.log(`⏭️  ${name}: skipped (pending deployment)`);
    continue;
  }

  // Health check
  try {
    const res = await fetch(`${url}/ok`, { headers: authHeaders, signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (!data.ok) throw new Error(`/ok returned ${JSON.stringify(data)}`);
    console.log(`✅ ${name}: healthy (${url})`);
  } catch (err) {
    console.error(`❌ ${name}: health check failed — ${(err as Error).message}`);
    failed++;
    continue;
  }

  if (smoke) {
    try {
      const threadRes = await fetch(`${url}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ metadata: {} }),
        signal: AbortSignal.timeout(10000),
      });
      const thread = await threadRes.json();
      const threadId = thread.thread_id;

      const runRes = await fetch(`${url}/threads/${threadId}/runs/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          assistant_id: name,
          input: { messages: [{ role: 'human', content: 'hello' }] },
          stream_mode: ['values'],
        }),
        signal: AbortSignal.timeout(30000),
      });

      const text = await runRes.text();
      if (!text.includes('"type":"ai"')) {
        throw new Error('No AI response in stream');
      }
      console.log(`✅ ${name}: smoke test passed`);
    } catch (err) {
      console.error(`❌ ${name}: smoke test failed — ${(err as Error).message}`);
      failed++;
      continue;
    }
  }

  passed++;
}

console.log(`\n${passed} passed, ${failed} failed out of ${entries.length}`);
if (failed > 0) process.exit(1);
}

main();
