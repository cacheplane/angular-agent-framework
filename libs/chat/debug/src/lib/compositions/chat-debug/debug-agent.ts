// SPDX-License-Identifier: MIT
import type { Signal } from '@angular/core';

export interface DebugAgentCheckpoint {
  id?: string;
  label?: string;
  values?: Record<string, unknown>;
}

export interface DebugAgent {
  messages: Signal<unknown[]>;
  status: Signal<string>;
  isLoading: Signal<boolean>;
  error: Signal<unknown>;
  toolCalls: Signal<unknown[]>;
  state: Signal<Record<string, unknown>>;
}

export interface DebugAgentWithHistory extends DebugAgent {
  history: Signal<DebugAgentCheckpoint[]>;
}
