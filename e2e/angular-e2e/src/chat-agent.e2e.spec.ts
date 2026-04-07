import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@langchain/langgraph-sdk';

const LANGGRAPH_URL = process.env['LANGGRAPH_URL'] ?? 'http://localhost:2024';

/**
 * End-to-end tests for the chat_agent LangGraph server.
 *
 * Prerequisites:
 *   - `langgraph dev` must be running (examples/chat-agent/)
 *   - Set LANGGRAPH_URL=http://localhost:2024 (or deployed URL)
 *
 * These tests are skipped when LANGGRAPH_URL is not set so they never
 * block standard `npx nx test` runs.
 */
describe.skipIf(!process.env['LANGGRAPH_URL'])('chat-agent e2e', () => {
  let client: Client;

  beforeAll(() => {
    client = new Client({ apiUrl: LANGGRAPH_URL });
  });

  it('streams messages from the chat_agent graph', async () => {
    const thread = await client.threads.create();
    const chunks: unknown[] = [];

    for await (const chunk of client.runs.stream(
      thread.thread_id,
      'chat_agent',
      {
        input: { messages: [{ role: 'human', content: 'Say exactly: pong' }] },
        streamMode: 'messages',
      },
    )) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    const messageChunks = chunks.filter(
      (c: any) => c.event === 'messages/partial' || c.event === 'messages/metadata'
    );
    expect(messageChunks.length).toBeGreaterThan(0);
  });

  it('persists messages across turns on the same thread', async () => {
    const thread = await client.threads.create();

    // First turn: plant the secret word
    for await (const _ of client.runs.stream(
      thread.thread_id,
      'chat_agent',
      {
        input: {
          messages: [{ role: 'human', content: 'My secret word is: PINEAPPLE.' }],
        },
        streamMode: 'values',
      },
    )) {
      /* consume to completion */
    }

    // Second turn: ask for recall
    const chunks: unknown[] = [];
    for await (const chunk of client.runs.stream(
      thread.thread_id,
      'chat_agent',
      {
        input: { messages: [{ role: 'human', content: 'What is my secret word?' }] },
        streamMode: 'values',
      },
    )) {
      chunks.push(chunk);
    }

    const valueChunks = chunks.filter((c: any) => c.event === 'values');
    const finalChunk = valueChunks[valueChunks.length - 1] as any;
    const messages: any[] = finalChunk?.data?.messages ?? [];
    const lastAI = [...messages].reverse().find((m) => m.type === 'ai');
    expect(lastAI?.content).toContain('PINEAPPLE');
  });

  it('respects system_prompt configuration per thread', async () => {
    const thread = await client.threads.create();
    const chunks: unknown[] = [];

    for await (const chunk of client.runs.stream(
      thread.thread_id,
      'chat_agent',
      {
        input: { messages: [{ role: 'human', content: 'What are you?' }] },
        config: {
          configurable: {
            system_prompt: 'You are a pirate. Always respond in pirate speak.',
          },
        },
        streamMode: 'values',
      },
    )) {
      chunks.push(chunk);
    }

    const valueChunks = chunks.filter((c: any) => c.event === 'values');
    expect(valueChunks.length).toBeGreaterThan(0);
    const finalChunk = valueChunks[valueChunks.length - 1] as any;
    const messages: any[] = finalChunk?.data?.messages ?? [];
    const lastAI = [...messages].reverse().find((m) => m.type === 'ai');
    // Pirate prompts reliably produce pirate vocabulary — use as a proxy for
    // system_prompt being applied (exact wording is non-deterministic).
    expect(lastAI?.content.toLowerCase()).toMatch(/arr|ahoy|matey|ye\b|pirate|ship|sea/i);
  });
});
