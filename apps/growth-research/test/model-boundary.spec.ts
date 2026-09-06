import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';
import { BoundedChatOpenAI } from '../src/runtime/model-boundary.js';
import { createPilotContext, withPilotContext } from '../src/pilot/context.js';
import { syntheticCorpus } from '../src/pilot/fixtures.js';

let server: Server | undefined;
it('captures reported provider usage after tool binding and closes the pilot marker at fetch', async () => {
  vi.stubEnv('GROWTH_RESEARCH_PILOT_MODE', 'local-company-only');
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', 'synthetic-only');
  let requests = 0;
  const baseURL = await endpoint((_request, response) => {
    requests++;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        id: 'mock',
        object: 'chat.completion',
        created: 1,
        model: 'gpt-4.1-mini',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'done',
              tool_calls: [
                {
                  id: 'invalid',
                  type: 'function',
                  function: {
                    name: 'submitCandidate',
                    arguments: '{"email":"do-not-retain@example.com"}',
                  },
                },
              ],
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
      })
    );
  });
  const bound = new BoundedChatOpenAI({
    apiKey: 'test',
    configuration: { baseURL },
  }).bindTools([]);
  await expect(
    bound.invoke([{ role: 'system', content: '[LOCAL_COMPANY_PILOT]' }])
  ).rejects.toThrow();
  expect(requests).toBe(0);
  const fixture = syntheticCorpus.cases[0];
  if (!fixture) throw new Error('fixture required');
  const context = createPilotContext(fixture);
  await withPilotContext(context, () =>
    bound.invoke([{ role: 'system', content: '[LOCAL_COMPANY_PILOT]' }])
  );
  expect(context.modelCalls).toBe(1);
  expect(context.inputTokens).toBe(12);
  expect(context.outputTokens).toBe(4);
  expect(context.attempts).toEqual([
    { validation: { status: 'rejected', reasonCodes: ['schema'] } },
  ]);
  expect(JSON.stringify(context.attempts)).not.toContain('do-not-retain');
});
afterEach(async () => {
  const current = server;
  current?.closeAllConnections();
  if (current)
    await new Promise<void>((resolve) => current.close(() => resolve()));
  server = undefined;
  vi.unstubAllEnvs();
});

async function endpoint(handler: RequestListener) {
  const current = createServer(handler);
  server = current;
  await new Promise<void>((resolve) => current.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(current.address() as AddressInfo).port}/v1`;
}

it('allows schema-only construction but requires the operator fixture gate before invocation', async () => {
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', '');
  const model = new BoundedChatOpenAI({ apiKey: 'synthetic-key' });
  await expect(model.invoke('blocked fixture')).rejects.toThrow(
    /fixture mode/i
  );
});

it('allows credential-free construction but refuses invocation without an actual credential', async () => {
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', 'synthetic-only');
  vi.stubEnv('OPENAI_API_KEY', '');
  const model = new BoundedChatOpenAI();
  await expect(model.invoke('missing credential')).rejects.toThrow(
    /OPENAI_API_KEY is required/
  );
});

it('sends one bounded provider request and never retries a retriable server failure', async () => {
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', 'synthetic-only');
  let requests = 0;
  let requestBody: unknown;
  const baseURL = await endpoint((request, response) => {
    requests++;
    let body = '';
    request.on('data', (chunk) => {
      body += String(chunk);
    });
    request.on('end', () => {
      requestBody = JSON.parse(body);
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ error: { message: 'Synthetic retryable failure' } })
      );
    });
  });
  const model = new BoundedChatOpenAI({
    apiKey: 'synthetic-key',
    model: 'gpt-4.1-mini',
    maxTokens: 9999,
    maxRetries: 4,
    configuration: { baseURL, maxRetries: 4 },
  });
  await expect(model.invoke('synthetic failure')).rejects.toThrow(/503/);
  expect(requests).toBe(1);
  expect(requestBody).toMatchObject({
    model: 'gpt-4.1-mini',
    max_tokens: 1024,
  });
});

it('aborts an unresponsive provider after the configured 20 second request deadline', async () => {
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', 'synthetic-only');
  let requests = 0;
  const baseURL = await endpoint(() => {
    requests++;
  });
  const model = new BoundedChatOpenAI({
    apiKey: 'synthetic-key',
    model: 'gpt-4.1-mini',
    timeout: 90_000,
    configuration: { baseURL, timeout: 90_000 },
  });
  const started = Date.now();
  await expect(model.invoke('synthetic timeout')).rejects.toThrow(
    /timed out|timeout/i
  );
  expect(Date.now() - started).toBeGreaterThanOrEqual(19_000);
  expect(Date.now() - started).toBeLessThan(27_000);
  expect(requests).toBe(1);
}, 30_000);
