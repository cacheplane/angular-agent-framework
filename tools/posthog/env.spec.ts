import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from './env.js';

test('parseEnv accepts a valid environment', () => {
  const env = parseEnv({
    POSTHOG_PERSONAL_API_KEY: 'phx_'.padEnd(40, 'a'),
    POSTHOG_PROJECT_ID: '12345',
  });
  assert.equal(env.POSTHOG_PERSONAL_API_KEY, 'phx_'.padEnd(40, 'a'));
  assert.equal(env.POSTHOG_HOST, 'https://us.i.posthog.com');
  assert.equal(env.POSTHOG_PROJECT_ID, 12345);
});

test('parseEnv coerces POSTHOG_PROJECT_ID to a number', () => {
  const env = parseEnv({
    POSTHOG_PERSONAL_API_KEY: 'phx_'.padEnd(40, 'a'),
    POSTHOG_PROJECT_ID: '987',
  });
  assert.equal(env.POSTHOG_PROJECT_ID, 987);
  assert.equal(typeof env.POSTHOG_PROJECT_ID, 'number');
});

test('parseEnv respects POSTHOG_HOST override', () => {
  const env = parseEnv({
    POSTHOG_PERSONAL_API_KEY: 'phx_'.padEnd(40, 'a'),
    POSTHOG_PROJECT_ID: '12345',
    POSTHOG_HOST: 'https://eu.i.posthog.com',
  });
  assert.equal(env.POSTHOG_HOST, 'https://eu.i.posthog.com');
});

test('parseEnv throws on missing required POSTHOG_PERSONAL_API_KEY', () => {
  assert.throws(
    () => parseEnv({ POSTHOG_PROJECT_ID: '12345' }),
    /POSTHOG_PERSONAL_API_KEY/,
  );
});

test('parseEnv throws on short key', () => {
  assert.throws(
    () => parseEnv({ POSTHOG_PERSONAL_API_KEY: 'short', POSTHOG_PROJECT_ID: '1' }),
    /POSTHOG_PERSONAL_API_KEY/,
  );
});

test('parseEnv throws on non-numeric POSTHOG_PROJECT_ID', () => {
  assert.throws(
    () => parseEnv({ POSTHOG_PERSONAL_API_KEY: 'phx_'.padEnd(40, 'a'), POSTHOG_PROJECT_ID: 'abc' }),
    /POSTHOG_PROJECT_ID/,
  );
});
