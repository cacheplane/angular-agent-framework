// SPDX-License-Identifier: MIT

/**
 * @typedef {{ angular: number; langgraph: number }} CapPorts
 * @typedef {Record<string, CapPorts>} PortsRegistry
 */

/**
 * Single source of truth for cockpit cap port allocation.
 *
 * ag-ui examples (cockpit-ag-ui-*) run a uvicorn `ag-ui-langgraph`
 * FastAPI backend; the `langgraph` field holds that backend port and
 * the Angular dev-server proxies /agent to it — so "langgraph" means
 * "backend port" for ag-ui caps, not a LangGraph Studio instance.
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
export const PORTS = Object.freeze({
  'cockpit-ag-ui-interrupts-angular': { angular: 4320, langgraph: 5320 },
  'cockpit-ag-ui-streaming-angular':  { angular: 4321, langgraph: 5321 },
  'cockpit-ag-ui-tool-views-angular': { angular: 4322, langgraph: 5322 },
  'cockpit-ag-ui-json-render-angular': { angular: 4323, langgraph: 5323 },
  'cockpit-ag-ui-a2ui-angular': { angular: 4324, langgraph: 5324 },
  'cockpit-ag-ui-client-tools-angular': { angular: 4325, langgraph: 5325 },
  'cockpit-ag-ui-subagents-angular': { angular: 4326, langgraph: 5326 },
  'cockpit-chat-a2ui-angular': { angular: 4511, langgraph: 5511 },
  'cockpit-chat-debug-angular': { angular: 4509, langgraph: 5509 },
  'cockpit-chat-generative-ui-angular': { angular: 4508, langgraph: 5508 },
  'cockpit-chat-input-angular': { angular: 4502, langgraph: 5502 },
  'cockpit-chat-interrupts-angular': { angular: 4503, langgraph: 5503 },
  'cockpit-chat-messages-angular': { angular: 4501, langgraph: 5501 },
  'cockpit-chat-subagents-angular': { angular: 4505, langgraph: 5505 },
  'cockpit-chat-theming-angular': { angular: 4510, langgraph: 5510 },
  'cockpit-chat-threads-angular': { angular: 4506, langgraph: 5506 },
  'cockpit-chat-timeline-angular': { angular: 4507, langgraph: 5507 },
  'cockpit-chat-tool-calls-angular': { angular: 4504, langgraph: 5504 },
  'cockpit-deep-agents-filesystem-angular': { angular: 4311, langgraph: 5311 },
  'cockpit-deep-agents-memory-angular': { angular: 4313, langgraph: 5313 },
  'cockpit-deep-agents-planning-angular': { angular: 4310, langgraph: 5310 },
  'cockpit-deep-agents-sandboxes-angular': { angular: 4315, langgraph: 5315 },
  'cockpit-deep-agents-skills-angular': { angular: 4314, langgraph: 5314 },
  'cockpit-deep-agents-subagents-angular': { angular: 4312, langgraph: 5312 },
  'cockpit-langgraph-client-tools-angular': { angular: 4308, langgraph: 5308 },
  'cockpit-langgraph-deployment-runtime-angular': { angular: 4307, langgraph: 5307 },
  'cockpit-langgraph-durable-execution-angular': { angular: 4304, langgraph: 5304 },
  'cockpit-langgraph-interrupts-angular': { angular: 4302, langgraph: 5302 },
  'cockpit-langgraph-memory-angular': { angular: 4303, langgraph: 5303 },
  'cockpit-langgraph-persistence-angular': { angular: 4301, langgraph: 5301 },
  'cockpit-langgraph-streaming-angular': { angular: 4300, langgraph: 5300 },
  'cockpit-langgraph-subgraphs-angular': { angular: 4305, langgraph: 5305 },
  'cockpit-langgraph-time-travel-angular': { angular: 4306, langgraph: 5306 },
  'cockpit-render-computed-functions-angular': { angular: 4406, langgraph: 5406 },
  'cockpit-render-element-rendering-angular': { angular: 4402, langgraph: 5402 },
  'cockpit-render-registry-angular': { angular: 4404, langgraph: 5404 },
  'cockpit-render-repeat-loops-angular': { angular: 4405, langgraph: 5405 },
  'cockpit-render-spec-rendering-angular': { angular: 4401, langgraph: 5401 },
  'cockpit-render-state-management-angular': { angular: 4403, langgraph: 5403 },
});

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
