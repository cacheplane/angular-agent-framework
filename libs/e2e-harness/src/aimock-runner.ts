// SPDX-License-Identifier: MIT
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface AimockHandle {
  readonly port: number;
  readonly baseUrl: string;
  stop(): Promise<void>;
}

export interface AimockStartOptions {
  mode: 'replay';
  fixturePath: string;
}

interface FixtureMatch {
  userMessage?: string;
  systemMessage?: string;
  hasToolResult?: boolean;
  responseFormat?: string;
  turnIndex?: number;
  model?: string;
}

interface FixtureResponse {
  content?: unknown;
  toolCalls?: Array<{ id?: string; name: string; arguments?: unknown }>;
}

interface FixtureEntry {
  match?: FixtureMatch;
  response: FixtureResponse;
  chunkSize?: number;
  latency?: number;
  streamingProfile?: { ttft?: number; tps?: number };
}

interface ChatMessage {
  role?: string;
  content?: unknown;
}

interface ChatRequest {
  model?: string;
  messages?: ChatMessage[];
  response_format?: { type?: string };
  stream?: boolean;
}

interface ResponsesInputItem {
  role?: string;
  content?: unknown;
  type?: string;
}

interface ResponsesRequest {
  model?: string;
  input?: ResponsesInputItem[];
  text?: { format?: { type?: string } };
  stream?: boolean;
}

type FixtureRequest = ChatRequest | ResponsesRequest;

interface ResponsesFunctionCallItem {
  id: string;
  call_id: string;
  type: 'function_call';
  name: string;
  arguments: string;
  status: 'completed';
}

interface ResponsesMessageItem {
  id: string;
  type: 'message';
  role: 'assistant';
  status: 'completed';
  content: Array<{
    type: 'output_text';
    text: string;
    annotations: never[];
    logprobs: never[];
  }>;
}

type ResponsesOutputItem = ResponsesFunctionCallItem | ResponsesMessageItem;

function loadFixtureEntries(fixturePath: string): FixtureEntry[] {
  const paths = statSync(fixturePath).isDirectory()
    ? readdirSync(fixturePath)
        .filter((file) => file.endsWith('.json'))
        .sort()
        .map((file) => join(fixturePath, file))
    : [fixturePath];
  return paths.flatMap((path) => {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { fixtures?: FixtureEntry[] };
    return parsed.fixtures ?? [];
  });
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && 'text' in part) {
        return String((part as { text?: unknown }).text ?? '');
      }
      return '';
    })
    .join('');
}

function requestContext(body: FixtureRequest) {
  const chatBody = body as ChatRequest;
  const responsesBody = body as ResponsesRequest;
  const messages: Array<ChatMessage & { type?: string }> = Array.isArray(chatBody.messages)
    ? chatBody.messages
    : responsesBody.input ?? [];
  let userIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      userIndex = index;
      break;
    }
  }
  return {
    model: body.model ?? '',
    userMessage: userIndex >= 0 ? messageText(messages[userIndex]?.content) : '',
    systemMessages: messages
      .filter((message) => message.role === 'system' || message.role === 'developer')
      .map((message) => messageText(message.content)),
    hasToolResult: messages.some((message) =>
      message.role === 'tool' || message.type === 'function_call_output'
    ),
    responseFormat: chatBody.response_format?.type ?? responsesBody.text?.format?.type,
    turnIndex:
      userIndex < 0
        ? 0
        : messages.slice(userIndex + 1).filter((message) =>
            message.role === 'assistant' || message.type === 'function_call'
          ).length,
  };
}

function matchesFixture(entry: FixtureEntry, body: FixtureRequest): boolean {
  const match = entry.match ?? {};
  const context = requestContext(body);
  if (
    match.userMessage !== undefined &&
    !context.userMessage.includes(match.userMessage)
  ) return false;
  if (
    match.systemMessage !== undefined &&
    !context.systemMessages.some((message) => message.includes(match.systemMessage as string))
  ) return false;
  if (match.hasToolResult !== undefined && match.hasToolResult !== context.hasToolResult) return false;
  if (match.responseFormat !== undefined && match.responseFormat !== context.responseFormat) return false;
  if (match.turnIndex !== undefined && match.turnIndex !== context.turnIndex) return false;
  if (match.model !== undefined && match.model !== context.model) return false;
  return true;
}

function toolCalls(response: FixtureResponse) {
  return response.toolCalls?.map((tool, index) => ({
    id: tool.id ?? `call_${randomUUID().replaceAll('-', '').slice(0, 24)}`,
    type: 'function',
    index,
    function: {
      name: tool.name,
      arguments:
        typeof tool.arguments === 'string' ? tool.arguments : JSON.stringify(tool.arguments ?? {}),
    },
  }));
}

function contentText(content: unknown): string {
  return typeof content === 'string' ? content : JSON.stringify(content ?? '');
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
}

async function sleep(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function streamingDelays(fixture: FixtureEntry): { first: number; subsequent: number } {
  const latency = fixture.latency ?? 0;
  const tokensPerSecond = fixture.streamingProfile?.tps;
  const throughputDelay = tokensPerSecond && tokensPerSecond > 0
    ? Math.max(1, Math.round(1000 / tokensPerSecond))
    : undefined;
  return {
    first: fixture.streamingProfile?.ttft ?? throughputDelay ?? latency,
    subsequent: throughputDelay ?? latency,
  };
}

async function streamResponse(
  res: ServerResponse,
  fixture: FixtureEntry,
  model: string,
): Promise<void> {
  const id = `chatcmpl-${randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const calls = toolCalls(fixture.response);
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  const send = (delta: Record<string, unknown>, finishReason: string | null = null) => {
    res.write(`data: ${JSON.stringify({
      id,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{ index: 0, delta, finish_reason: finishReason }],
    })}\n\n`);
  };

  const delays = streamingDelays(fixture);
  await sleep(delays.first);
  send({ role: 'assistant' });
  if (calls?.length) {
    send({ tool_calls: calls }, 'tool_calls');
  } else {
    const content = contentText(fixture.response.content);
    const chunkSize = Math.max(1, fixture.chunkSize ?? 4096);
    for (let offset = 0; offset < content.length; offset += chunkSize) {
      send({ content: content.slice(offset, offset + chunkSize) });
      await sleep(delays.subsequent);
    }
    send({}, 'stop');
  }
  res.end('data: [DONE]\n\n');
}

function responsesOutput(fixture: FixtureEntry): ResponsesOutputItem[] {
  if (fixture.response.toolCalls?.length) {
    return fixture.response.toolCalls.map((tool) => ({
      id: `fc_${randomUUID().replaceAll('-', '')}`,
      call_id: tool.id ?? `call_${randomUUID().replaceAll('-', '').slice(0, 24)}`,
      type: 'function_call',
      name: tool.name,
      arguments:
        typeof tool.arguments === 'string' ? tool.arguments : JSON.stringify(tool.arguments ?? {}),
      status: 'completed',
    }));
  }
  return [{
    id: `msg_${randomUUID().replaceAll('-', '')}`,
    type: 'message',
    role: 'assistant',
    status: 'completed',
    content: [{
      type: 'output_text',
      text: contentText(fixture.response.content),
      annotations: [],
      logprobs: [],
    }],
  }];
}

function responsesEnvelope(
  id: string,
  createdAt: number,
  model: string,
  output: ReturnType<typeof responsesOutput>,
  status: 'in_progress' | 'completed',
) {
  const completed = status === 'completed';
  return {
    id,
    object: 'response',
    created_at: createdAt,
    completed_at: completed ? createdAt : null,
    status,
    background: false,
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: null,
    max_tool_calls: null,
    metadata: null,
    model,
    output: completed ? output : [],
    parallel_tool_calls: true,
    previous_response_id: null,
    prompt: null,
    reasoning: null,
    service_tier: 'default',
    temperature: null,
    text: { format: { type: 'text' } },
    tool_choice: 'auto',
    tools: [],
    top_p: null,
    truncation: 'disabled',
    usage: completed
      ? {
          input_tokens: 0,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens: 0,
          output_tokens_details: { reasoning_tokens: 0 },
          total_tokens: 0,
        }
      : null,
  };
}

async function streamResponsesApi(
  res: ServerResponse,
  fixture: FixtureEntry,
  model: string,
): Promise<void> {
  const id = `resp_${randomUUID().replaceAll('-', '')}`;
  const createdAt = Math.floor(Date.now() / 1000);
  const output = responsesOutput(fixture);
  let sequenceNumber = 0;
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  const send = (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify({ ...event, sequence_number: sequenceNumber++ })}\n\n`);
  };

  send({
    type: 'response.created',
    response: responsesEnvelope(id, createdAt, model, output, 'in_progress'),
  });
  const delays = streamingDelays(fixture);
  await sleep(delays.first);

  for (let outputIndex = 0; outputIndex < output.length; outputIndex += 1) {
    const item = output[outputIndex];
    if (item.type === 'function_call') {
      send({
        type: 'response.output_item.added',
        output_index: outputIndex,
        item: { ...item, arguments: '', status: 'in_progress' },
      });
      send({
        type: 'response.function_call_arguments.delta',
        output_index: outputIndex,
        item_id: item.id,
        delta: item.arguments,
      });
      send({
        type: 'response.function_call_arguments.done',
        output_index: outputIndex,
        item_id: item.id,
        name: item.name,
        arguments: item.arguments,
      });
      send({ type: 'response.output_item.done', output_index: outputIndex, item });
      continue;
    }

    const pendingItem = { ...item, status: 'in_progress', content: [] };
    send({ type: 'response.output_item.added', output_index: outputIndex, item: pendingItem });
    const content = item.content[0];
    send({
      type: 'response.content_part.added',
      output_index: outputIndex,
      content_index: 0,
      item_id: item.id,
      part: { ...content, text: '' },
    });
    const chunkSize = Math.max(1, fixture.chunkSize ?? 4096);
    for (let offset = 0; offset < content.text.length; offset += chunkSize) {
      send({
        type: 'response.output_text.delta',
        output_index: outputIndex,
        content_index: 0,
        item_id: item.id,
        delta: content.text.slice(offset, offset + chunkSize),
        logprobs: [],
      });
      await sleep(delays.subsequent);
    }
    send({
      type: 'response.output_text.done',
      output_index: outputIndex,
      content_index: 0,
      item_id: item.id,
      text: content.text,
      logprobs: [],
    });
    send({
      type: 'response.content_part.done',
      output_index: outputIndex,
      content_index: 0,
      item_id: item.id,
      part: content,
    });
    send({ type: 'response.output_item.done', output_index: outputIndex, item });
  }

  send({
    type: 'response.completed',
    response: responsesEnvelope(id, createdAt, model, output, 'completed'),
  });
  res.end('data: [DONE]\n\n');
}

async function readRequest(req: IncomingMessage): Promise<FixtureRequest> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as FixtureRequest;
}

export async function startAimock(opts: AimockStartOptions): Promise<AimockHandle> {
  const entries = loadFixtureEntries(opts.fixturePath);
  let server: Server;
  server = createServer(async (req, res) => {
    if (req.method === 'GET') {
      json(res, 200, { ok: true });
      return;
    }
    const isChatCompletions = req.url?.endsWith('/chat/completions');
    const isResponsesApi = req.url?.endsWith('/responses');
    if (req.method !== 'POST' || (!isChatCompletions && !isResponsesApi)) {
      json(res, 404, { error: { message: 'Unsupported fixture endpoint' } });
      return;
    }
    try {
      const body = await readRequest(req);
      const fixture = entries.find((entry) => matchesFixture(entry, body));
      if (!fixture) {
        json(res, 404, {
          error: { message: `No fixture matched request: ${JSON.stringify(requestContext(body))}` },
        });
        return;
      }
      const model = body.model ?? 'fixture-model';
      if (isResponsesApi) {
        const output = responsesOutput(fixture);
        if (body.stream) {
          await streamResponsesApi(res, fixture, model);
          return;
        }
        json(
          res,
          200,
          responsesEnvelope(
            `resp_${randomUUID().replaceAll('-', '')}`,
            Math.floor(Date.now() / 1000),
            model,
            output,
            'completed',
          ),
        );
        return;
      }
      if (body.stream) {
        await streamResponse(res, fixture, model);
        return;
      }
      const calls = toolCalls(fixture.response);
      json(res, 200, {
        id: `chatcmpl-${randomUUID()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: calls?.length ? null : contentText(fixture.response.content),
            ...(calls?.length ? { tool_calls: calls } : {}),
          },
          finish_reason: calls?.length ? 'tool_calls' : 'stop',
        }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      });
    } catch (error) {
      json(res, 400, {
        error: { message: error instanceof Error ? error.message : String(error) },
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server did not bind a TCP port');
  let stopped = false;
  return {
    port: address.port,
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    async stop() {
      if (stopped) return;
      stopped = true;
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
