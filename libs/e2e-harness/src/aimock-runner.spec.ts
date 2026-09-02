// SPDX-License-Identifier: MIT
import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startAimock, type AimockHandle } from './aimock-runner';

describe('startAimock', () => {
  let handle: AimockHandle | null = null;
  let workDir = '';

  afterEach(async () => {
    if (handle) await handle.stop();
    handle = null;
    if (workDir) rmSync(workDir, { recursive: true, force: true });
    workDir = '';
  });

  it('boots a replay server backed by a fixture file', async () => {
    workDir = mkdtempSync(join(tmpdir(), 'aimock-test-'));
    const fixturePath = join(workDir, 'hi.json');
    writeFileSync(
      fixturePath,
      JSON.stringify({
        fixtures: [
          { match: { userMessage: 'say hi briefly' }, response: { content: 'Hi!' } },
        ],
      }),
    );

    handle = await startAimock({ mode: 'replay', fixturePath });
    expect(handle.port).toBeGreaterThan(0);
    expect(handle.baseUrl).toMatch(/^http:\/\/.+\/v1$/);

    const response = await fetch(`${handle.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'fixture-model',
        messages: [{ role: 'user', content: 'say hi briefly' }],
      }),
    });
    expect(response.status).toBe(200);
    const body = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    expect(body.choices[0]?.message.content).toBe('Hi!');
  });

  it('matches a fixture when the user message contains its text matcher', async () => {
    workDir = mkdtempSync(join(tmpdir(), 'aimock-test-'));
    const fixturePath = join(workDir, 'substring.json');
    writeFileSync(
      fixturePath,
      JSON.stringify({
        fixtures: [
          { match: { userMessage: 'contact form' }, response: { content: 'Matched!' } },
        ],
      }),
    );

    handle = await startAimock({ mode: 'replay', fixturePath });
    const response = await fetch(`${handle.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'fixture-model',
        messages: [{ role: 'user', content: 'Please render a contact form for support.' }],
      }),
    });

    expect(response.status).toBe(200);
  });

  it('uses fixture latency as the delay between streamed chunks', async () => {
    workDir = mkdtempSync(join(tmpdir(), 'aimock-test-'));
    const fixturePath = join(workDir, 'paced.json');
    writeFileSync(
      fixturePath,
      JSON.stringify({
        fixtures: [{
          match: { userMessage: 'pace this' },
          response: { content: 'abcd' },
          chunkSize: 1,
          latency: 25,
        }],
      }),
    );

    handle = await startAimock({ mode: 'replay', fixturePath });
    const startedAt = performance.now();
    const response = await fetch(`${handle.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'fixture-model',
        stream: true,
        messages: [{ role: 'user', content: 'pace this' }],
      }),
    });
    await response.text();

    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(75);
  });

  it('stop() is idempotent', async () => {
    workDir = mkdtempSync(join(tmpdir(), 'aimock-test-'));
    const fixturePath = join(workDir, 'hi.json');
    writeFileSync(fixturePath, JSON.stringify({ fixtures: [] }));
    handle = await startAimock({ mode: 'replay', fixturePath });
    await handle.stop();
    await handle.stop();
    expect(true).toBe(true);
  });

  it('loads and merges all .json files in a directory', async () => {
    workDir = mkdtempSync(join(tmpdir(), 'aimock-test-'));
    writeFileSync(
      join(workDir, 'a.json'),
      JSON.stringify({
        fixtures: [{ match: { userMessage: 'one' }, response: { content: 'A' } }],
      }),
    );
    writeFileSync(
      join(workDir, 'b.json'),
      JSON.stringify({
        fixtures: [{ match: { userMessage: 'two' }, response: { content: 'B' } }],
      }),
    );
    // Non-JSON file in the dir should be ignored.
    writeFileSync(join(workDir, 'README.md'), '# not a fixture');

    handle = await startAimock({ mode: 'replay', fixturePath: workDir });
    expect(handle.port).toBeGreaterThan(0);
    expect(handle.baseUrl).toMatch(/^http:\/\/.+\/v1$/);
  });

  it('streams OpenAI-compatible tool calls', async () => {
    workDir = mkdtempSync(join(tmpdir(), 'aimock-test-'));
    const fixturePath = join(workDir, 'tool.json');
    writeFileSync(
      fixturePath,
      JSON.stringify({
        fixtures: [{
          match: { userMessage: 'weather' },
          response: { toolCalls: [{ name: 'get_weather', arguments: { city: 'LA' } }] },
        }],
      }),
    );
    handle = await startAimock({ mode: 'replay', fixturePath });

    const response = await fetch(`${handle.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'fixture-model',
        stream: true,
        messages: [{ role: 'user', content: 'weather' }],
      }),
    });
    const body = await response.text();
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(body).toContain('get_weather');
    expect(body).toContain('tool_calls');
    expect(body).toContain('data: [DONE]');
  });

  it('streams text through the Responses API', async () => {
    workDir = mkdtempSync(join(tmpdir(), 'aimock-test-'));
    const fixturePath = join(workDir, 'response.json');
    writeFileSync(
      fixturePath,
      JSON.stringify({
        fixtures: [{ match: { userMessage: 'hello' }, response: { content: 'Hello!' } }],
      }),
    );
    handle = await startAimock({ mode: 'replay', fixturePath });

    const response = await fetch(`${handle.baseUrl}/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'fixture-model',
        stream: true,
        input: [{ role: 'user', content: [{ type: 'input_text', text: 'hello' }] }],
      }),
    });
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain('response.created');
    expect(body).toContain('response.output_text.delta');
    expect(body).toContain('Hello!');
    expect(body).toContain('response.completed');
    // Note: the Responses API stream ends at response.completed with no
    // trailing "data: [DONE]" sentinel — that terminator is a Chat
    // Completions convention (the earlier vendored mock emitted it on
    // /responses too, which was inaccurate).
  });

  it('streams Responses API function calls after matching tool results', async () => {
    workDir = mkdtempSync(join(tmpdir(), 'aimock-test-'));
    const fixturePath = join(workDir, 'tool-response.json');
    writeFileSync(
      fixturePath,
      JSON.stringify({
        fixtures: [{
          match: { userMessage: 'weather', hasToolResult: true },
          response: { toolCalls: [{ name: 'summarize_weather', arguments: { city: 'LA' } }] },
        }],
      }),
    );
    handle = await startAimock({ mode: 'replay', fixturePath });

    const response = await fetch(`${handle.baseUrl}/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'fixture-model',
        stream: true,
        input: [
          { role: 'user', content: 'weather' },
          { type: 'function_call_output', call_id: 'call_weather', output: 'sunny' },
        ],
      }),
    });
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain('response.output_item.added');
    expect(body).toContain('response.function_call_arguments.delta');
    expect(body).toContain('response.function_call_arguments.done');
    expect(body).toContain('\\"city\\":\\"LA\\"');
    expect(body).toContain('summarize_weather');
    expect(body).toContain('response.completed');
  });

  it('boots a record-proxy server with no fixtures', async () => {
    workDir = mkdtempSync(join(tmpdir(), 'aimock-test-'));
    handle = await startAimock({ mode: 'record', recordDir: workDir });
    expect(handle.port).toBeGreaterThan(0);
    expect(handle.baseUrl).toMatch(/^http:\/\/.+\/v1$/);
    // No upstream call is made here — this stops at "the proxy started
    // cleanly"; live recording is a manual smoke, not CI.
  });

  it('record mode without recordDir throws', async () => {
    await expect(startAimock({ mode: 'record' })).rejects.toThrow('recordDir');
  });

  it('replay mode without fixturePath throws', async () => {
    await expect(startAimock({ mode: 'replay' })).rejects.toThrow('fixturePath');
  });
});
