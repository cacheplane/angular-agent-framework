// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { runAgentConformance } from './agent-conformance';
import { mockAgent } from './mock-agent';

runAgentConformance('mockAgent', () => mockAgent());
