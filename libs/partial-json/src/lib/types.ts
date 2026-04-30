// SPDX-License-Identifier: MIT

/** Kinds of JSON values a node can represent. */
export type JsonNodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

/** Parsing state of a node. */
export type JsonNodeStatus = 'pending' | 'streaming' | 'complete';

/** Base shape shared by all nodes. */
export interface JsonNodeBase {
  /** Stable identity — assigned on creation, never changes. */
  readonly id: number;
  /** What kind of JSON value this node represents. */
  readonly type: JsonNodeType;
  /** Parsing state. */
  status: JsonNodeStatus;
  /** Parent node (null for root). */
  parent: JsonNode | null;
  /** Key in parent — string for object properties, number for array indices. */
  key: string | number | null;
}

export interface JsonObjectNode extends JsonNodeBase {
  readonly type: 'object';
  children: Map<string, JsonNode>;
  /** Key currently being built (between quote open and colon). */
  pendingKey: string | null;
}

export interface JsonArrayNode extends JsonNodeBase {
  readonly type: 'array';
  children: JsonNode[];
}

export interface JsonStringNode extends JsonNodeBase {
  readonly type: 'string';
  /** Grows character-by-character as tokens arrive. */
  value: string;
}

export interface JsonNumberNode extends JsonNodeBase {
  readonly type: 'number';
  /** Raw characters accumulated so far. */
  raw: string;
  /** Parsed value — set when node completes. */
  value: number | null;
}

export interface JsonBooleanNode extends JsonNodeBase {
  readonly type: 'boolean';
  value: boolean;
}

export interface JsonNullNode extends JsonNodeBase {
  readonly type: 'null';
}

export type JsonNode =
  | JsonObjectNode
  | JsonArrayNode
  | JsonStringNode
  | JsonNumberNode
  | JsonBooleanNode
  | JsonNullNode;

/** Events emitted by the parser as the tree changes. */
export interface ParseEvent {
  type: 'node-created' | 'value-updated' | 'node-completed';
  node: JsonNode;
  /** For value-updated on strings: the characters appended this push. */
  delta?: string;
}

/** Push-based streaming JSON parser. */
export interface PartialJsonParser {
  /** Feed characters. Returns events for what changed. */
  push(chunk: string): ParseEvent[];
  /** Root node of the parse tree. */
  readonly root: JsonNode | null;
  /** Look up a node by JSON Pointer path (e.g., "/elements/el-1/props"). */
  getByPath(path: string): JsonNode | null;
}
