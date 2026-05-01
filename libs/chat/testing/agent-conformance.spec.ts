// SPDX-License-Identifier: MIT
import { runAgentConformance } from './agent-conformance';
import { mockAgent } from './mock-agent';

runAgentConformance('mockAgent', () => mockAgent());
