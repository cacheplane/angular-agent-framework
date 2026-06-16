// SPDX-License-Identifier: MIT
export type { ClientToolSpec, ClientToolsState, OpenAIFunctionTool, BaseMessage } from './types';
export {
  clientToolSpecs,
  clientToolNames,
  lastMessage,
  hasClientToolCall,
  hasServerToolCall,
  bindClientTools,
  routeAfterAgent,
  type BindableModel,
} from './middleware';
// extras (added in later tasks):
// export { clientToolsChannel } from './channel';
// export { clientToolsRouter } from './router';
