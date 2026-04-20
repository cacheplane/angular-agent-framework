// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
export { createDb } from './lib/client.js';
export type { Db } from './lib/client.js';
export * from './lib/schema/index.js';
export { markEventProcessed, deleteProcessedEvent } from './lib/queries/processed-events.js';
