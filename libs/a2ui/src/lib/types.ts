// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// --- Theme ---

export interface A2uiTheme {
  primaryColor?: string;
  iconUrl?: string;
  agentDisplayName?: string;
}

// --- Dynamic value types ---

export interface A2uiPathRef {
  path: string;
}

export interface A2uiFunctionCall {
  call: string;
  args: Record<string, unknown>;
  returnType?: string;
}

/** A value that can be a literal, a path reference, or a function call. */
export type DynamicValue<T> = T | A2uiPathRef | A2uiFunctionCall;
export type DynamicString = DynamicValue<string>;
export type DynamicNumber = DynamicValue<number>;
export type DynamicBoolean = DynamicValue<boolean>;
export type DynamicStringList = DynamicValue<string[]>;

// --- Children ---

export interface A2uiChildTemplate {
  path: string;
  componentId: string;
}

export type A2uiChildList = string[] | A2uiChildTemplate;

// --- Actions (Phase 2 — type definitions only) ---

export interface A2uiEventAction {
  event: { name: string; context?: Record<string, unknown> };
}

export interface A2uiLocalAction {
  functionCall: A2uiFunctionCall;
}

export type A2uiAction = A2uiEventAction | A2uiLocalAction;

// --- Validation (v0.9 CheckRule) ---

export interface A2uiCheckRule {
  condition: DynamicBoolean;
  message: string;
}

// --- Components ---

export interface A2uiComponent {
  id: string;
  component: string;
  children?: A2uiChildList;
  action?: A2uiAction;
  checks?: A2uiCheckRule[];
  [key: string]: unknown;
}

// --- Messages ---

export interface A2uiCreateSurface {
  type: 'createSurface';
  surfaceId: string;
  catalogId: string;
  theme?: A2uiTheme;
  sendDataModel?: boolean;
}

export interface A2uiUpdateComponents {
  type: 'updateComponents';
  surfaceId: string;
  components: A2uiComponent[];
}

export interface A2uiUpdateDataModel {
  type: 'updateDataModel';
  surfaceId: string;
  path?: string;
  value?: unknown;
}

export interface A2uiDeleteSurface {
  type: 'deleteSurface';
  surfaceId: string;
}

export type A2uiMessage =
  | A2uiCreateSurface
  | A2uiUpdateComponents
  | A2uiUpdateDataModel
  | A2uiDeleteSurface;

// --- Surface ---

export interface A2uiSurface {
  surfaceId: string;
  catalogId: string;
  theme?: A2uiTheme;
  components: Map<string, A2uiComponent>;
  dataModel: Record<string, unknown>;
}
