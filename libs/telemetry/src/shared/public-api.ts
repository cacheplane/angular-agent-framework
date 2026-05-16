// SPDX-License-Identifier: MIT
export type { NgafEvent, NgafNodeEvent, NgafBrowserEvent } from './events';
export {
  getEmailDomain,
  getSourcePage,
  normalizePostHogHost,
  toSafeAnalyticsString,
} from './properties';
export { PERSONAL_EMAIL_DOMAINS, isPersonalEmailDomain } from './personal-email-domains';
