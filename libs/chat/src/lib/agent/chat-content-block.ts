// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

export type ChatContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'tool_use'; id: string; name: string; args: unknown }
  | { type: 'tool_result'; toolCallId: string; result: unknown; isError?: boolean };
