// SPDX-License-Identifier: MIT
import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
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

export async function getAccessToken(nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
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
  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Token exchange returned no access_token.');
  return json.access_token;
}
