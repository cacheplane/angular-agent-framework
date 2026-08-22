// SPDX-License-Identifier: MIT
import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

/** Refresh this many seconds before the token's actual expiry, not exactly at it. */
const REFRESH_SKEW_SECONDS = 60;

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

interface CachedToken {
  accessToken: string;
  /** Epoch seconds at which the token stops being usable (server-reported expiry). */
  expiresAtSeconds: number;
}

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function readServiceAccountKey(): ServiceAccountKey {
  const raw = process.env['GSC_SERVICE_ACCOUNT_JSON'];
  if (!raw) {
    throw new Error(
      'GSC_SERVICE_ACCOUNT_JSON is not set. See apps/website/scripts/gsc/README.md.',
    );
  }
  const parsed = JSON.parse(raw) as Partial<ServiceAccountKey>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('GSC_SERVICE_ACCOUNT_JSON is missing client_email or private_key.');
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

let cachedToken: CachedToken | null = null;
let inFlightExchange: Promise<CachedToken> | null = null;

/**
 * Clears the in-process access-token cache. Exists so tests (and long-lived
 * callers that suspect a revoked/expired token) can force a fresh exchange.
 */
export function resetAccessTokenCache(): void {
  cachedToken = null;
  inFlightExchange = null;
}

async function exchangeAccessToken(nowSeconds: number): Promise<CachedToken> {
  const key = readServiceAccountKey();
  const signingInput = [
    base64url({ alg: 'RS256', typ: 'JWT' }),
    base64url({
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  ].join('.');
  const signature = createSign('RSA-SHA256')
    .update(signingInput)
    .sign(key.private_key, 'base64url');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${signingInput}.${signature}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${await response.text()}`);
  }
  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error('Token exchange returned no access_token.');
  return {
    accessToken: json.access_token,
    expiresAtSeconds: nowSeconds + (json.expires_in ?? 3600),
  };
}

export async function getAccessToken(nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  if (cachedToken && cachedToken.expiresAtSeconds - REFRESH_SKEW_SECONDS > nowSeconds) {
    return cachedToken.accessToken;
  }

  if (!inFlightExchange) {
    inFlightExchange = exchangeAccessToken(nowSeconds).finally(() => {
      inFlightExchange = null;
    });
  }

  const token = await inFlightExchange;
  cachedToken = token;
  return token.accessToken;
}
