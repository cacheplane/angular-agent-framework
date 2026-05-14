import { z } from 'zod';

const envSchema = z.object({
  POSTHOG_PERSONAL_API_KEY: z
    .string()
    .min(20, 'POSTHOG_PERSONAL_API_KEY must be at least 20 characters'),
  POSTHOG_HOST: z
    .string()
    .url()
    .default('https://us.i.posthog.com'),
  POSTHOG_PROJECT_ID: z.coerce
    .number({ invalid_type_error: 'POSTHOG_PROJECT_ID must be numeric' })
    .int('POSTHOG_PROJECT_ID must be an integer')
    .positive('POSTHOG_PROJECT_ID must be positive'),
});

export type PosthogEnv = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined>): PosthogEnv {
  return envSchema.parse(source);
}

// Lazy singleton for runtime use. Tests pass their own source to parseEnv directly.
let cached: PosthogEnv | null = null;
export function env(): PosthogEnv {
  if (!cached) cached = parseEnv(process.env);
  return cached;
}
