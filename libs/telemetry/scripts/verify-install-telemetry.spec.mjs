import { describe, expect, it } from 'vitest';

import { verifyInstallTelemetryManifest } from './verify-install-telemetry.mjs';

describe('verify-install-telemetry', () => {
  it('requires publishable packages to depend on telemetry and run the postinstall hook', () => {
    expect(() => verifyInstallTelemetryManifest({
      name: '@ngaf/chat',
      dependencies: {},
      scripts: {},
    }, '/tmp/dist/libs/chat/package.json')).toThrow(/@ngaf\/chat/);

    expect(() => verifyInstallTelemetryManifest({
      name: '@ngaf/chat',
      dependencies: { '@ngaf/telemetry': '*' },
      scripts: { postinstall: 'ngaf-telemetry-postinstall || true' },
    }, '/tmp/dist/libs/chat/package.json')).not.toThrow();
  });

  it('does not require the telemetry package to install itself', () => {
    expect(() => verifyInstallTelemetryManifest({
      name: '@ngaf/telemetry',
      dependencies: {},
      scripts: {},
    }, '/tmp/dist/libs/telemetry/package.json')).not.toThrow();
  });
});
