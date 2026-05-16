import { describe, expect, it } from 'vitest';
import {
  assertObservedPostinstallEvents,
  expectedPostinstallPackages,
} from './smoke-install-telemetry.mjs';

describe('smoke-install-telemetry', () => {
  it('expects every publishable package with a postinstall hook to emit install telemetry', () => {
    const roots = [
      { manifest: { name: '@ngaf/chat', scripts: { postinstall: 'ngaf-telemetry-postinstall || true' } }, root: 'dist/libs/chat' },
      { manifest: { name: '@ngaf/langgraph', scripts: { postinstall: 'ngaf-telemetry-postinstall || true' } }, root: 'dist/libs/langgraph' },
      { manifest: { name: '@ngaf/telemetry', scripts: { postinstall: 'node ./node/postinstall.js || true' } }, root: 'dist/libs/telemetry' },
    ];

    expect(expectedPostinstallPackages(roots)).toEqual(['@ngaf/chat', '@ngaf/langgraph', '@ngaf/telemetry']);
  });

  it('fails when an expected package did not send a postinstall event', () => {
    expect(() => assertObservedPostinstallEvents({
      expectedPackages: ['@ngaf/chat', '@ngaf/langgraph'],
      events: [
        { event: 'ngaf:postinstall', properties: { pkg: '@ngaf/chat' } },
      ],
    })).toThrow(/Missing ngaf:postinstall events for @ngaf\/langgraph/);
  });

  it('ignores non-postinstall events when proving package coverage', () => {
    expect(() => assertObservedPostinstallEvents({
      expectedPackages: ['@ngaf/chat'],
      events: [
        { event: 'ngaf:runtime_request_created', properties: { pkg: '@ngaf/chat' } },
      ],
    })).toThrow(/Missing ngaf:postinstall events for @ngaf\/chat/);
  });
});
