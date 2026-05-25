// SPDX-License-Identifier: MIT
export type { ThreadplaneEvent, ThreadplaneNodeEvent, ThreadplaneBrowserEvent } from './events';
export {
  getEmailDomain,
  getSourcePage,
  normalizePostHogHost,
  toSafeAnalyticsString,
} from './properties';
export { PERSONAL_EMAIL_DOMAINS, isPersonalEmailDomain } from './personal-email-domains';
