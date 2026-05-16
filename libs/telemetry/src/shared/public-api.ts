// SPDX-License-Identifier: MIT
export type { NgafEvent, NgafNodeEvent, NgafBrowserEvent } from './events';
export {
  getEmailDomain,
  getSourcePage,
  normalizePostHogHost,
  toSafeAnalyticsString,
} from './properties';
