import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';
import { BoundedChatOpenAI } from '../src/runtime/model-boundary.js';

let server: Server | undefined;
afterEach(async () => {
  const current = server;
  current?.closeAllConnections();
  if (current) await new Promise<void>(resolve => current.close(() => resolve()));
  server = undefined;
  vi.unstubAllEnvs();
});

async function endpoint(handler: RequestListener) {
  const current = createServer(handler);
  server = current;
  await new Promise<void>(resolve => current.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(current.address() as AddressInfo).port}/v1`;
}

it('allows schema-only construction but requires the operator fixture gate before invocation', async () => {
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', '');
  const model = new BoundedChatOpenAI({ apiKey: 'synthetic-key' });
  await expect(model.invoke('blocked fixture')).rejects.toThrow(/fixture mode/i);
});

it('allows credential-free construction but refuses invocation without an actual credential', async () => {
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', 'synthetic-only');
  vi.stubEnv('OPENAI_API_KEY', '');
  const model = new BoundedChatOpenAI();
  await expect(model.invoke('missing credential')).rejects.toThrow(/OPENAI_API_KEY is required/);
});

it('sends one bounded provider request and never retries a retriable server failure', async () => {
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', 'synthetic-only');
  let requests = 0;
  let requestBody: unknown;
  const baseURL = await endpoint((request, response) => {
    requests++;
    let body = '';
    request.on('data', chunk => { body += String(chunk); });
    request.on('end', () => {
      requestBody = JSON.parse(body);
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'Synthetic retryable failure' } }));
    });
  });
  const model = new BoundedChatOpenAI({ apiKey: 'synthetic-key', model: 'gpt-4.1-mini', maxTokens: 9999, maxRetries: 4, configuration: { baseURL, maxRetries: 4 } });
  await expect(model.invoke('synthetic failure')).rejects.toThrow(/503/);
  expect(requests).toBe(1);
  expect(requestBody).toMatchObject({ model: 'gpt-4.1-mini', max_tokens: 1024 });
});

it('aborts an unresponsive provider after the configured 20 second request deadline', async () => {
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', 'synthetic-only');
  let requests = 0;
  const baseURL = await endpoint(() => { requests++; });
  const model = new BoundedChatOpenAI({ apiKey: 'synthetic-key', model: 'gpt-4.1-mini', timeout: 90_000, configuration: { baseURL, timeout: 90_000 } });
  const started = Date.now();
  await expect(model.invoke('synthetic timeout')).rejects.toThrow(/timed out|timeout/i);
  expect(Date.now() - started).toBeGreaterThanOrEqual(19_000);
  expect(Date.now() - started).toBeLessThan(27_000);
  expect(requests).toBe(1);
}, 30_000);
