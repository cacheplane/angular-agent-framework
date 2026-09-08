import type { Message } from '@ag-ui/core';

/** Serializable protocol state at a confirmed run boundary. */
export interface ThreadSnapshot {
  state: Record<string, unknown>;
  messages: Message[];
}

/** Keeps failed/optimistic run input separate from the last confirmed boundary. */
export class RunStateTransaction {
  private boundary: ThreadSnapshot;
  constructor(initial: ThreadSnapshot) { this.boundary = structuredClone(initial); }
  get committed(): ThreadSnapshot { return structuredClone(this.boundary); }
  begin(): ThreadSnapshot { return this.committed; }
  commit(snapshot: ThreadSnapshot): void { this.boundary = structuredClone(snapshot); }
  rollback(): ThreadSnapshot { return this.committed; }
}
