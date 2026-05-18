// SPDX-License-Identifier: MIT
import { http } from '../http';

const TOKEN_URL = 'https://api.x.com/2/oauth2/token';

const REQUIRED_ENV = [
  'X_CLIENT_ID',
  'X_CLIENT_SECRET',
  'X_ACCESS_TOKEN',
  'X_REFRESH_TOKEN',
  'X_USER_HANDLE',
] as const;

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
};

export class XAuth {
  public accessToken: string;
  public refreshToken: string;
  public readonly userHandle: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor() {
    const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      throw new Error(`X adapter missing env vars: ${missing.join(', ')}`);
    }
    this.clientId = process.env.X_CLIENT_ID!;
    this.clientSecret = process.env.X_CLIENT_SECRET!;
    this.accessToken = process.env.X_ACCESS_TOKEN!;
    this.refreshToken = process.env.X_REFRESH_TOKEN!;
    this.userHandle = process.env.X_USER_HANDLE!;
  }

  async refresh(): Promise<void> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
    });
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    let tokens: TokenResponse;
    try {
      tokens = await http<TokenResponse>({
        method: 'POST',
        url: TOKEN_URL,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basic}`,
        },
        body: params.toString(),
        retryOn5xx: false,
      });
    } catch (err) {
      throw new Error(
        `X access token expired and refresh failed — re-run \`pnpm marketing:channels:x:auth\`. Underlying: ${(err as Error).message}`,
      );
    }
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;
    process.stderr.write(
      `\n✓ X refresh successful. Update your .env to keep the new refresh token across restarts:\n  X_ACCESS_TOKEN=${tokens.access_token}\n  X_REFRESH_TOKEN=${tokens.refresh_token}\n\n`,
    );
  }
}
