// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { A2uiMessage } from './types';

const ENVELOPE_KEYS = ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface'] as const;
type EnvelopeKey = typeof ENVELOPE_KEYS[number];

export interface A2uiMessageParser {
  push(chunk: string): A2uiMessage[];
}

export function createA2uiMessageParser(): A2uiMessageParser {
  let buffer = '';

  function parseEnvelope(json: Record<string, unknown>): A2uiMessage | null {
    for (const key of ENVELOPE_KEYS) {
      if (key in json && typeof json[key] === 'object' && json[key] !== null) {
        const payload = json[key] as Record<string, unknown>;
        return { type: key, ...payload } as unknown as A2uiMessage;
      }
    }
    return null;
  }

  function push(chunk: string): A2uiMessage[] {
    buffer += chunk;
    const messages: A2uiMessage[] = [];

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (!line) continue;

      try {
        const json = JSON.parse(line);
        const msg = parseEnvelope(json);
        if (msg) messages.push(msg);
      } catch {
        // Skip malformed lines
      }
    }

    return messages;
  }

  return { push };
}
