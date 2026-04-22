// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { runChatAgentConformance } from './chat-agent-conformance';
import { mockChatAgent } from './mock-chat-agent';

runChatAgentConformance('mockChatAgent', () => mockChatAgent());
