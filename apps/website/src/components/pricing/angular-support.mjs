// SPDX-License-Identifier: MIT
export const WEBSITE_SUPPORTED_ANGULAR_MAJORS = Object.freeze([20, 21, 22]);

export const WEBSITE_SUPPORTED_ANGULAR_VERSIONS = `Angular ${WEBSITE_SUPPORTED_ANGULAR_MAJORS.join(
  ', '
)}`;

const WEBSITE_SUPPORTED_ANGULAR_SUMMARY = `Angular ${WEBSITE_SUPPORTED_ANGULAR_MAJORS.slice(
  0,
  -1
).join(', ')}, and ${WEBSITE_SUPPORTED_ANGULAR_MAJORS.at(-1)}`;

export const WEBSITE_PRICING_SUPPORT_SUMMARY = `${WEBSITE_SUPPORTED_ANGULAR_SUMMARY} support`;

export const WEBSITE_ANGULAR_SUPPORT_ROWS = Object.freeze([
  Object.freeze({
    label: 'Supported',
    versions: WEBSITE_SUPPORTED_ANGULAR_VERSIONS,
    tone: 'success',
  }),
  Object.freeze({ label: 'Experimental', versions: '—', tone: 'warn' }),
  Object.freeze({ label: 'Planned', versions: '—', tone: 'info' }),
  Object.freeze({
    label: 'Unsupported',
    versions: 'Angular ≤19',
    tone: 'muted',
  }),
]);
