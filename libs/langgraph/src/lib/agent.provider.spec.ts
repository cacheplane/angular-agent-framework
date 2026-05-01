// SPDX-License-Identifier: MIT
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideAgent, AGENT_CONFIG } from './agent.provider';
import { MockAgentTransport } from './transport/mock-stream.transport';
import {
  signLicense,
  generateKeyPair,
  __resetRunLicenseCheckStateForTests,
  __resetNagStateForTests,
} from '@ngaf/licensing/testing';

describe('provideAgent', () => {
  beforeEach(() => {
    __resetRunLicenseCheckStateForTests();
    __resetNagStateForTests();
  });

  it('provides AGENT_CONFIG token', () => {
    TestBed.configureTestingModule({
      providers: [provideAgent({ apiUrl: 'https://api.example.com' })],
    });
    const config = TestBed.inject(AGENT_CONFIG);
    expect(config.apiUrl).toBe('https://api.example.com');
  });

  it('provides custom transport via config', () => {
    const transport = new MockAgentTransport();
    TestBed.configureTestingModule({
      providers: [provideAgent({ apiUrl: '', transport })],
    });
    const config = TestBed.inject(AGENT_CONFIG);
    expect(config.transport).toBe(transport);
  });

  it('runs a silent license check when a valid license is supplied', async () => {
    const warn = vi.fn();
    globalThis.console.warn = warn;
    const kp = await generateKeyPair();
    const token = await signLicense(
      {
        sub: 'cus_test',
        tier: 'developer-seat',
        iat: 1_700_000_000,
        exp: 2_000_000_000,
        seats: 1,
      },
      kp.privateKey,
    );
    TestBed.configureTestingModule({
      providers: [
        provideAgent({
          apiUrl: '',
          license: token,
          // @internal hook — verifies against the ephemeral pair so the test
          // doesn't need to know/mint the production public key.
          __licensePublicKey: kp.publicKey,
        }),
      ],
    });
    TestBed.inject(AGENT_CONFIG);
    // Allow microtasks from the ed25519 verify + telemetry fire-and-forget.
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when license is missing and env is production-like', async () => {
    const warn = vi.fn();
    globalThis.console.warn = warn;
    TestBed.configureTestingModule({
      providers: [
        provideAgent({ apiUrl: '', __licenseEnvHint: { isNoncommercial: false } }),
      ],
    });
    TestBed.inject(AGENT_CONFIG);
    await new Promise((r) => setTimeout(r, 0));
    const calls = warn.mock.calls.map((c) => String(c[0]));
    expect(calls.some((m) => m.includes('[cacheplane] @ngaf/langgraph'))).toBe(true);
  });
});
