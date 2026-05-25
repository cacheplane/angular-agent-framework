#!/usr/bin/env node
// SPDX-License-Identifier: MIT

/**
 * Pure-function classifier for the cockpit-e2e matrix.
 *
 * @param {Array<{angular: string, python: string}>} allCockpitCaps
 *        All cockpit angular projects with an e2e target, paired with
 *        their python sibling path. Derived from the project graph by
 *        the CLI wrapper (or hard-coded in tests).
 * @param {Set<string>} affectedNames
 *        Set of project names nx-affected returned for this diff.
 * @param {{fullFleet: boolean}} opts
 *        fullFleet=true forces all caps regardless of affected. Set by
 *        the CLI on push events and on the empty-affected fallback.
 * @returns {Array<{angular: string, python: string}>}
 *        Caps to dispatch as matrix entries, preserving the order of
 *        `allCockpitCaps`.
 */
export function selectCockpitCaps(allCockpitCaps, affectedNames, { fullFleet }) {
  if (fullFleet) return allCockpitCaps;
  return allCockpitCaps.filter((cap) => affectedNames.has(cap.angular));
}
