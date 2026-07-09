// SPDX-License-Identifier: MIT
export { action, view, ask, tools } from './tools';
export { deriveJsonSchema } from './to-json-schema';
export type {
  ClientToolContinuationOptions,
  ClientToolContinuationLimitEvent,
  ClientToolContinuationPolicy,
  ClientToolLifecycle,
  ClientToolLifecyclePhase,
  ClientToolViewProps,
  ClientToolDef,
  ClientToolExecutionOptions,
  FunctionToolDef,
  FunctionToolHandlerContext,
  AnyFunctionToolDef,
  ViewToolDef,
  AskToolDef,
  ClientToolRegistry,
} from './tool-def';
export type { ClientToolSpec } from './to-json-schema';
export type { ClientToolsCapability, ClientToolResult } from './client-tools-capability';
export { validateArgs, executeFunctionTool } from './execute';
export { selectPendingClientToolCalls } from './select-pending-client-tool-calls';
export type { SelectPendingClientToolCallsInput } from './select-pending-client-tool-calls';
export { startClientToolExecutor } from './client-tool-executor';
export type { ClientToolExecutorOptions } from './client-tool-executor';
export { createClientToolsCoordinator, toClientToolSpecs } from './client-tools-coordinator';
export type { ClientToolsCoordinator, ClientToolsCoordinatorOptions } from './client-tools-coordinator';
export {
  clientToolGuardFailureResult,
  defaultInterruptedClientToolResult,
  shouldClaimBeforeExecute,
} from './client-tool-execution-guard';
export type {
  ClientToolExecutionGuard,
  ClientToolExecutionKey,
  ClientToolExecutionRecord,
  ClientToolExecutionStore,
} from './client-tool-execution-guard';
