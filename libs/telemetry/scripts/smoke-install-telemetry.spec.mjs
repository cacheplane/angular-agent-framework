import { describe, expect, it } from 'vitest';
import {
  assertObservedPostinstallEvents,
  expectedPostinstallPackages,
} from './smoke-install-telemetry.mjs';

describe('smoke-install-telemetry', () => {
  it('expects every publishable package with a postinstall hook to emit install telemetry', () => {
    const roots = [
      { manifest: { name: '@threadplane/chat', scripts: { postinstall: 'threadplane-telemetry-postinstall || true' } }, root: 'dist/libs/chat' },
      { manifest: { name: '@threadplane/langgraph', scripts: { postinstall: 'threadplane-telemetry-postinstall || true' } }, root: 'dist/libs/langgraph' },
      { manifest: { name: '@threadplane/telemetry', scripts: { postinstall: 'node ./node/postinstall.js || true' } }, root: 'dist/libs/telemetry' },
    ];

    expect(expectedPostinstallPackages(roots)).toEqual(['@threadplane/chat', '@threadplane/langgraph', '@threadplane/telemetry']);
  });

  it('fails when an expected package did not send a postinstall event', () => {
    expect(() => assertObservedPostinstallEvents({
      expectedPackages: ['@threadplane/chat', '@threadplane/langgraph'],
      events: [
        { event: 'tplane:postinstall', properties: { pkg: '@threadplane/chat' } },
      ],
    })).toThrow(/Missing tplane:postinstall events for @threadplane\/langgraph/);
  });

  it('ignores non-postinstall events when proving package coverage', () => {
    expect(() => assertObservedPostinstallEvents({
      expectedPackages: ['@threadplane/chat'],
      events: [
        { event: 'tplane:runtime_request_created', properties: { pkg: '@threadplane/chat' } },
      ],
    })).toThrow(/Missing tplane:postinstall events for @threadplane\/chat/);
  });
});
