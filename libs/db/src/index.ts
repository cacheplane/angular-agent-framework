// SPDX-License-Identifier: MIT
export { createDb } from './lib/client.js';
export type { Db } from './lib/client.js';
export * from './lib/schema/index.js';
export { markEventProcessed, deleteProcessedEvent } from './lib/queries/processed-events.js';
export {
  upsertLicense,
  getLicense,
  getLicensesByCustomerEmail,
  revokeLicense,
  updateLicenseToken,
} from './lib/queries/licenses.js';
export type { UpsertLicenseInput } from './lib/queries/licenses.js';
