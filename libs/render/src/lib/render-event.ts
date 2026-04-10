// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

export interface RenderHandlerEvent {
  readonly type: 'handler';
  readonly action: string;
  readonly params: Record<string, unknown>;
  readonly result?: unknown;
}

export interface RenderStateChangeEvent {
  readonly type: 'stateChange';
  readonly path: string;
  readonly value: unknown;
  readonly snapshot: Record<string, unknown>;
}

export interface RenderLifecycleEvent {
  readonly type: 'lifecycle';
  readonly event: 'mounted' | 'destroyed';
  readonly scope: 'spec' | 'element';
  readonly elementKey?: string;
  readonly elementType?: string;
}

export type RenderEvent =
  | RenderHandlerEvent
  | RenderStateChangeEvent
  | RenderLifecycleEvent;
