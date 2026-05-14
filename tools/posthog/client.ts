import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './types/posthog-api.gen.js';
import { env } from './env.js';

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

const retryMiddleware: Middleware = {
  async onResponse({ response, request }) {
    let attempt = 1;
    let res = response;
    while (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_ATTEMPTS) {
      const backoffMs = Math.min(8000, 500 * 2 ** (attempt - 1));
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      res = await fetch(request.clone());
      attempt += 1;
    }
    return res;
  },
};

export function createPosthogClient() {
  const e = env();
  const client = createClient<paths>({
    baseUrl: `${e.POSTHOG_HOST}/api/projects/${e.POSTHOG_PROJECT_ID}`,
    headers: {
      Authorization: `Bearer ${e.POSTHOG_PERSONAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  client.use(retryMiddleware);
  return client;
}

// Lazy singleton.
let cached: ReturnType<typeof createPosthogClient> | null = null;
export function ph() {
  if (!cached) cached = createPosthogClient();
  return cached;
}
