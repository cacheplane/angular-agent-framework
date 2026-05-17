import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@langchain/langgraph-sdk';

const LANGGRAPH_URL = process.env['LANGGRAPH_URL'] ?? 'http://localhost:2024';

interface MessageLike {
  content?: unknown;
  kwargs?: {
    content?: unknown;
    type?: string;
  };
  role?: string;
  type?: string;
}

function messageText(message: MessageLike | undefined): string {
  const content = message?.content ?? message?.kwargs?.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === 'string') {
        return part;
      }
      if (part && typeof part === 'object' && 'text' in part) {
        return String(part.text ?? '');
      }
      return JSON.stringify(part);
    }).join('');
  }
  return content == null ? '' : String(content);
}

function messageType(message: MessageLike): string | undefined {
  return message.type ?? message.role ?? message.kwargs?.type;
}

function lastMessageOfType(messages: MessageLike[], type: string): MessageLike | undefined {
  return [...messages].reverse().find((message) => messageType(message) === type);
}

function messagesContainText(messages: MessageLike[], text: string): boolean {
  return messages.some((message) => messageText(message).includes(text));
}

describe('message state assertions', () => {
  it('treats persisted human messages as evidence of thread state', () => {
    const messages = [
      { type: 'human', content: 'My secret word is: PINEAPPLE.' },
      { type: 'ai', content: 'I will remember that.' },
      { type: 'human', content: 'What is my secret word?' },
      { type: 'ai', content: 'I have the earlier turn in context.' },
    ];

    expect(messagesContainText(messages, 'My secret word is: PINEAPPLE.')).toBe(true);
    expect(messagesContainText(messages, 'What is my secret word?')).toBe(true);
  });

  it('requires a completed AI turn without depending on exact natural language', () => {
    const messages = [
      { type: 'human', content: 'What are you?' },
      { type: 'ai', content: 'A running assistant response.' },
    ];

    expect(messageText(lastMessageOfType(messages, 'ai')).length).toBeGreaterThan(0);
  });
});

/**
 * End-to-end tests for the chat LangGraph server.
 *
 * Prerequisites:
 *   - `langgraph dev` must be running (examples/chat/python/)
 *   - Set LANGGRAPH_URL=http://localhost:2024 (or deployed URL)
 *
 * These tests are skipped when LANGGRAPH_URL is not set so they never
 * block standard `npx nx test` runs.
 */
describe.skipIf(!process.env['LANGGRAPH_URL'])('examples/chat e2e', () => {
  let client: Client;

  beforeAll(() => {
    client = new Client({ apiUrl: LANGGRAPH_URL });
  });

  it('streams messages from the chat graph', async () => {
    const thread = await client.threads.create();
    const chunks: unknown[] = [];

    for await (const chunk of client.runs.stream(
      thread.thread_id,
      'chat',
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
      'chat',
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
      'chat',
      {
        input: { messages: [{ role: 'human', content: 'What is my secret word?' }] },
        streamMode: 'values',
      },
    )) {
      chunks.push(chunk);
    }

    const valueChunks = chunks.filter((c: any) => c.event === 'values');
    const finalChunk = valueChunks[valueChunks.length - 1] as any;
    const messages: MessageLike[] = finalChunk?.data?.messages ?? [];
    expect(messagesContainText(messages, 'My secret word is: PINEAPPLE.')).toBe(true);
    expect(messagesContainText(messages, 'What is my secret word?')).toBe(true);
    expect(messageText(lastMessageOfType(messages, 'ai')).length).toBeGreaterThan(0);
  });

  it('accepts system_prompt configuration per thread', async () => {
    const thread = await client.threads.create();
    const chunks: unknown[] = [];

    for await (const chunk of client.runs.stream(
      thread.thread_id,
      'chat',
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
    const messages: MessageLike[] = finalChunk?.data?.messages ?? [];
    expect(messagesContainText(messages, 'What are you?')).toBe(true);
    expect(messageText(lastMessageOfType(messages, 'ai')).length).toBeGreaterThan(0);
  });
});
