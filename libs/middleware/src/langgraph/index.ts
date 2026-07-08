// SPDX-License-Identifier: MIT
export type { ClientToolSpec, ClientToolsState, OpenAIFunctionTool, BaseMessage } from './types.js';
export {
  clientToolSpecs,
  clientToolNames,
  lastMessage,
  hasClientToolCall,
  hasServerToolCall,
  bindClientTools,
  routeAfterAgent,
  type BindableModel,
} from './middleware.js';
export { clientToolsChannel } from './channel.js';
export { clientToolsRouter } from './router.js';
export {
  createInMemoryClientToolExecutionStore,
} from './client-tool-execution-store.js';
export type {
  ClientToolExecutionKey,
  ClientToolExecutionRecord,
  ClientToolExecutionStatus,
  ClientToolExecutionStore,
  ClientToolResult,
} from './client-tool-execution-store.js';
export {
  extractClientToolResultMessages,
  filterDuplicateClientToolResultMessages,
  lookupClientToolExecutions,
  recordClientToolResults,
} from './client-tool-result-guard.js';
export type {
  ClientToolResultMessage,
  RecordClientToolResultsInput,
  RecordClientToolResultsResult,
} from './client-tool-result-guard.js';
export {
  THREADPLANE_CLIENT_TOOL_EXECUTIONS_SCHEMA,
  createPostgresClientToolExecutionStore,
} from './postgres-client-tool-execution-store.js';
export type {
  PostgresClientToolExecutionStoreOptions,
  PostgresRow,
  PostgresTaggedSql,
} from './postgres-client-tool-execution-store.js';
