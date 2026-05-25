import { describe, expect, it } from 'vitest';

import { verifyInstallTelemetryManifest } from './verify-install-telemetry.mjs';

describe('verify-install-telemetry', () => {
  it('requires publishable packages to depend on telemetry and run the postinstall hook', () => {
    expect(() => verifyInstallTelemetryManifest({
      name: '@threadplane/chat',
      dependencies: {},
      scripts: {},
    }, '/tmp/dist/libs/chat/package.json')).toThrow(/@threadplane\/chat/);

    expect(() => verifyInstallTelemetryManifest({
      name: '@threadplane/chat',
      dependencies: { '@threadplane/telemetry': '*' },
      scripts: { postinstall: 'threadplane-telemetry-postinstall || true' },
    }, '/tmp/dist/libs/chat/package.json')).not.toThrow();
  });

  it('does not require the telemetry package to install itself', () => {
    expect(() => verifyInstallTelemetryManifest({
      name: '@threadplane/telemetry',
      dependencies: {},
      scripts: {},
    }, '/tmp/dist/libs/telemetry/package.json')).not.toThrow();
  });
});
