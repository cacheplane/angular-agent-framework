import { seedModelImporter } from '@dawn-ai/langchain';
import { ChatOpenAI } from '@langchain/openai';
import { assertFixtureMode } from './fixture-contract.js';

export const providerLimits = { maxTokens: 1024, maxRetries: 0, timeout: 20_000 } as const;

export class BoundedChatOpenAI extends ChatOpenAI {
  readonly #guard: () => void;

  constructor(options: ConstructorParameters<typeof ChatOpenAI>[0] = {}) {
    const apiKey = options.apiKey || process.env['OPENAI_API_KEY'];
    const guard = () => {
      assertFixtureMode();
      if (!apiKey) throw new Error('OPENAI_API_KEY is required for synthetic model invocation');
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
        fetch: (input, init) => { guard(); return fetch(input, init); },
      },
    });
    this.#guard = guard;
  }

  override async _generate(...args: Parameters<ChatOpenAI['_generate']>) {
    this.#guard();
    return super._generate(...args);
  }

  override async *_streamResponseChunks(...args: Parameters<ChatOpenAI['_streamResponseChunks']>) {
    this.#guard();
    yield* super._streamResponseChunks(...args);
  }
}

// Public Dawn bootstrap hook; this app owns its process and permits one provider.
seedModelImporter(async specifier => {
  if (specifier !== '@langchain/openai') throw new Error('Synthetic research supports only the bounded OpenAI provider');
  return { ChatOpenAI: BoundedChatOpenAI };
});
