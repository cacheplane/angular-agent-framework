// SPDX-License-Identifier: MIT

/**
 * @typedef {{ angular: number; langgraph: number }} CapPorts
 * @typedef {Record<string, CapPorts>} PortsRegistry
 */

/**
 * Single source of truth for cockpit cap port allocation.
 *
 * Excludes cockpit-ag-ui-streaming-angular — uses a non-LangGraph
 * backend (Node ag-ui server on :3000, /agent proxy). Single-cap
 * exception; left as a literal in its own files.
 *
 * Port ranges:
 *   - angular: [4000, 5000)
 *   - langgraph: [5000, 6000)
 *   - Convention: langgraph = angular + 1000
 *
 * The CI verifier (scripts/cockpit-ports.spec.mjs) asserts this
 * registry matches the literal --port values in each cap's
 * python/project.json + baseURL in playwright.config.ts.
 *
 * @type {PortsRegistry}
 */
export const PORTS = Object.freeze({});

/**
 * Look up ports for a cap by its Nx angular project name.
 * Throws if the name isn't in the registry — caller crash for
 * fast diagnosis.
 *
 * @param {string} cap
 * @returns {CapPorts}
 */
export function portsFor(cap) {
  const p = PORTS[cap];
  if (!p) throw new Error(`No port allocation for ${cap}`);
  return p;
}
