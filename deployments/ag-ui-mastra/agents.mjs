// Mastra agent definitions for the `mastra` runtime-portability topic
// (cockpit/runtimes/mastra/). This service IS that topic's backend — the
// registry entry has no pythonDir, so unlike the Python lane there is no
// per-example module staged into a generated deployment; the agent lives
// here, next to the HTTP shim that serves it.
//
// The agent exercises every green cell of the measured matrix on one route:
// - streaming chat (TEXT_MESSAGE_CHUNK)
// - one backend tool (`check_conditions` → TOOL_CALL_* + TOOL_CALL_RESULT)
// - shared state via working memory (STATE_SNAPSHOT + STATE_DELTA — Mastra
//   emits real JSON-Patch deltas, measured in the spike's 04a capture)
// - suspend/resume human-in-the-loop (`reserve_campsite` → CUSTOM
//   on_interrupt + RUN_FINISHED outcome interrupt; resume arrives as
//   forwardedProps.command.interruptEvent{toolCallId,runId})
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';

/** Model string resolved by Mastra's model router. It honors the standard
 *  OPENAI_API_KEY and OPENAI_BASE_URL env vars, which is what lets the
 *  aimock e2e harness intercept calls without any code fork. */
const MODEL = 'openai/gpt-4o-mini';

const NIGHTLY_RATE_USD = 45;

// #region check-conditions-tool
/** Deterministic backend tool — no external calls, stable for fixtures. */
const checkConditionsTool = createTool({
  id: 'check_conditions',
  description: 'Check current trail and weather conditions for a location.',
  inputSchema: z.object({ location: z.string().describe('Park or trailhead name') }),
  outputSchema: z.object({
    location: z.string(),
    forecast: z.string(),
    high_c: z.number(),
    low_c: z.number(),
  }),
  execute: async (inputData) => ({
    location: inputData.location,
    forecast: 'Clear skies, light afternoon breeze',
    high_c: 18,
    low_c: 4,
  }),
});
// #endregion

// #region reserve-campsite-tool
/**
 * Human-in-the-loop tool. First call suspends the run (persisted to LibSQL —
 * suspend/resume REQUIRES persistent storage, a spike finding); the frontend
 * shows an approval card and resumes with `{ approved: boolean }`.
 */
const reserveCampsiteTool = createTool({
  id: 'reserve_campsite',
  description:
    'Reserve a campsite. Requires explicit user approval: the tool pauses the run and shows the user a confirmation card before booking.',
  inputSchema: z.object({
    site: z.string().describe('Campsite name'),
    nights: z.number().int().min(1).describe('Number of nights'),
  }),
  suspendSchema: z.object({
    site: z.string(),
    nights: z.number(),
    total_usd: z.number(),
  }),
  resumeSchema: z.object({
    approved: z.boolean().optional(),
  }),
  execute: async (inputData, context) => {
    const { resumeData, suspend } = context?.agent ?? {};
    if (!resumeData) {
      return suspend?.({
        site: inputData.site,
        nights: inputData.nights,
        total_usd: inputData.nights * NIGHTLY_RATE_USD,
      });
    }
    if (resumeData.approved) {
      return `Reserved ${inputData.site} for ${inputData.nights} night(s) — total $${
        inputData.nights * NIGHTLY_RATE_USD
      }. Confirmation TP-${String(inputData.nights).padStart(2, '0')}88.`;
    }
    return `Reservation for ${inputData.site} was declined by the user. Nothing was booked.`;
  },
});
// #endregion

/**
 * Build the Mastra instance for this service.
 *
 * @param {string} dbUrl LibSQL url (`file:/path/to/mastra.db`). File-backed
 *   storage is required: Mastra persists suspended-run snapshots there, and
 *   resume loads them back — an in-memory store would break resume across
 *   HTTP requests (and across restarts on Railway, hence the volume).
 */
export function createMastra(dbUrl) {
  const store = (id) => new LibSQLStore({ id, url: dbUrl });

  // #region weather-forecaster
  /**
   * Sub-agent (spike: wire-capture-subagents.md). Registered on the
   * supervisor via `agents:`; Mastra surfaces it as a backend tool named
   * `agent-weather_forecaster` whose TOOL_CALL_RESULT carries the child's
   * final text — server.mjs's subagent emitter turns that into SUBAGENT_*
   * frames. The `description` becomes the delegation tool's description.
   */
  const weatherForecaster = new Agent({
    id: 'weather_forecaster',
    name: 'weather_forecaster',
    description: 'Forecasts weather for a campsite and date range. Use for any weather question.',
    instructions:
      'You are a weather forecaster. Given a campsite and dates, give a 3-bullet forecast summary. Be concise.',
    model: MODEL,
  });
  // #endregion

  // #region trip-agent
  const tripAgent = new Agent({
    id: 'mastra',
    name: 'mastra',
    instructions: `You are a terse camping trip planner.
The packing list in working memory is the user's shared state: whenever the user adds, removes, or changes items (or starts a list), update working memory to match. 'items' is an array of {name, qty}. Never mention memory or the list mechanics.
For questions about trail conditions you MUST call check_conditions.
For questions about weather forecasts you MUST delegate to the weather_forecaster agent.
When the user asks to reserve or book a campsite you MUST call reserve_campsite; after it resumes, confirm the outcome.
Always answer in one short sentence.`,
    model: MODEL,
    tools: {
      check_conditions: checkConditionsTool,
      reserve_campsite: reserveCampsiteTool,
    },
    agents: { weather_forecaster: weatherForecaster },
    memory: new Memory({
      storage: store('mastra-topic-memory'),
      options: {
        workingMemory: {
          enabled: true,
          schema: z.object({
            packing_list: z.object({
              title: z.string().describe('Packing list title'),
              items: z
                .array(z.object({ name: z.string(), qty: z.number() }))
                .describe('All items on the list'),
            }),
          }),
        },
      },
    }),
  });
  // #endregion

  return new Mastra({
    agents: { mastra: tripAgent },
    storage: store('mastra-instance'),
  });
}
