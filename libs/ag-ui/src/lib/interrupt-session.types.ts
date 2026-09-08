import type { Interrupt, ResumeEntry } from '@ag-ui/core';
import type { AgentInterrupt, AgentSubmitInput } from '@threadplane/chat';

export type InterruptTransport = 'auto' | 'protocol' | 'legacy-command' | 'mastra-command';
export type InterruptSessionPhase = 'none' | 'collecting' | 'pending' | 'claimed' | 'resuming' | 'acknowledged' | 'uncertain' | 'recovery-required';

export interface ResumeAttempt {
  id: string;
  runId: string;
  input: AgentSubmitInput;
  parameters: { resume?: ResumeEntry[]; forwardedProps?: Record<string, unknown> };
  generation: number;
}

export interface InterruptSessionSnapshot {
  phase: InterruptSessionPhase;
  generation: number;
  interrupts: Interrupt[];
  legacy?: AgentInterrupt;
  runId?: string;
  attempt?: ResumeAttempt;
}
