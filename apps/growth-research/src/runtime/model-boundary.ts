import { seedModelImporter } from '@dawn-ai/langchain';
import { ChatOpenAI } from '@langchain/openai';
import { assertFixtureMode } from './fixture-contract.js';
import {
  assertPilotContext,
  countModelRequest,
  getPilotContext,
  recordRejectedSubmission,
  trackPilotOperation,
  type PilotEvent,
} from '../pilot/context.js';

export const providerLimits = {
  maxTokens: 1024,
  maxRetries: 0,
  timeout: 20_000,
} as const;

export class BoundedChatOpenAI extends ChatOpenAI {
  readonly #guard: () => void;

  constructor(options: ConstructorParameters<typeof ChatOpenAI>[0] = {}) {
    const apiKey = options.apiKey || process.env['OPENAI_API_KEY'];
    const guard = () => {
      if (getPilotContext()) assertPilotContext();
      else assertFixtureMode();
      if (!apiKey)
        throw new Error(
          'OPENAI_API_KEY is required for synthetic model invocation'
        );
    };
    super({
      ...options,
      // Schema extraction constructs a model. The placeholder cannot reach the
      // provider: both invocation methods and the actual fetch call check guard.
      apiKey: apiKey || 'growth-research-schema-only',
      ...providerLimits,
      configuration: {
        ...options.configuration,
        maxRetries: providerLimits.maxRetries,
        timeout: providerLimits.timeout,
        fetch: async (input, init) => {
          // bindTools delegates to an internal ChatOpenAI instance, so this
          // transport check is authoritative even when subclass methods are bypassed.
          if (
            typeof init?.body === 'string' &&
            init.body.includes('[LOCAL_COMPANY_PILOT]')
          )
            assertPilotContext();
          guard();
          const context = getPilotContext();
          if (context) {
            countModelRequest();
            return trackPilotOperation(context, async () => {
              const event: PilotEvent = {
                kind: 'model',
                callIndex: context.modelCalls,
                startedAt: Date.now(),
                endedAt: 0,
                outcome: 'failed',
              };
              try {
                const transport = await fetch(input, {
                  ...init,
                  signal: AbortSignal.any([
                    ...(init?.signal ? [init.signal] : []),
                    context.controller.signal,
                    AbortSignal.timeout(providerLimits.timeout),
                  ]),
                });
                // Drain the network body inside the tracked operation. LangGraph
                // can reject its invocation before the underlying fetch settles.
                const bytes = await transport.arrayBuffer();
                assertPilotContext();
                const response = new Response(bytes, {
                  status: transport.status,
                  statusText: transport.statusText,
                  headers: transport.headers,
                });
                if (
                  response.ok &&
                  response.headers
                    .get('content-type')
                    ?.includes('application/json')
                ) {
                  const body = (await response.clone().json()) as {
                    choices?: {
                      message?: {
                        tool_calls?: {
                          function?: { name?: string; arguments?: string };
                        }[];
                      };
                    }[];
                    usage?: {
                      prompt_tokens?: number;
                      completion_tokens?: number;
                    };
                  };
                  const usage = body.usage;
                  if (
                    Number.isSafeInteger(usage?.prompt_tokens) &&
                    (usage?.prompt_tokens ?? -1) >= 0
                  )
                    event.inputTokens = usage?.prompt_tokens;
                  if (
                    Number.isSafeInteger(usage?.completion_tokens) &&
                    (usage?.completion_tokens ?? -1) >= 0
                  )
                    event.outputTokens = usage?.completion_tokens;
                  assertPilotContext();
                  for (const choice of body.choices ?? []) {
                    for (const call of choice.message?.tool_calls ?? []) {
                      if (call.function?.name !== 'submitCandidate') continue;
                      let value: unknown;
                      try {
                        value = JSON.parse(call.function.arguments ?? 'null');
                      } catch {
                        value = null;
                      }
                      recordRejectedSubmission(value);
                    }
                  }
                  if (typeof usage?.prompt_tokens === 'number')
                    context.inputTokens =
                      (context.inputTokens ?? 0) + usage.prompt_tokens;
                  if (typeof usage?.completion_tokens === 'number')
                    context.outputTokens =
                      (context.outputTokens ?? 0) + usage.completion_tokens;
                }
                event.outcome = response.ok ? 'succeeded' : 'failed';
                return response;
              } finally {
                event.endedAt = Date.now();
                context.events.push(event);
              }
            });
          }
          return fetch(input, init);
        },
      },
    });
    this.#guard = guard;
  }

  override async _generate(...args: Parameters<ChatOpenAI['_generate']>) {
    if (
      args[0].some(
        (message) =>
          typeof message.content === 'string' &&
          message.content.includes('[LOCAL_COMPANY_PILOT]')
      )
    )
      assertPilotContext();
    this.#guard();
    return super._generate(...args);
  }

  override async *_streamResponseChunks(
    ...args: Parameters<ChatOpenAI['_streamResponseChunks']>
  ) {
    if (
      args[0].some(
        (message) =>
          typeof message.content === 'string' &&
          message.content.includes('[LOCAL_COMPANY_PILOT]')
      )
    )
      assertPilotContext();
    this.#guard();
    yield* super._streamResponseChunks(...args);
  }
}

// Public Dawn bootstrap hook; this app owns its process and permits one provider.
seedModelImporter(async (specifier) => {
  if (specifier !== '@langchain/openai')
    throw new Error(
      'Synthetic research supports only the bounded OpenAI provider'
    );
  return { ChatOpenAI: BoundedChatOpenAI };
});
