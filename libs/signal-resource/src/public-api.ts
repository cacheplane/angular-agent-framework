// SPDX-License-Identifier: MIT
export { toAgent } from './lib/to-agent';
export type {
  SignalChatResourceLike,
  SignalChatResourceMessage,
  SignalChatResourceToolCall,
} from './lib/to-agent';
export { provideAgent, injectAgent } from './lib/provide-agent';
export type { SignalResourceAgentSource } from './lib/provide-agent';
