// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

export type ToolCallStatus = 'pending' | 'running' | 'complete' | 'error';

export interface ToolCall {
  id: string;
  name: string;
  /** Arguments. May be partial while streaming (`status !== 'complete'`). */
  args: unknown;
  status: ToolCallStatus;
  /** Present when status === 'complete' or 'error'. */
  result?: unknown;
  /** Optional error payload when status === 'error'. */
  error?: unknown;
}
