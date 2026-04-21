import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import * as ed from '@noble/ed25519';
import { createHash } from 'node:crypto';

// jsdom's SubtleCrypto implementation rejects TypedArray inputs that originate
// from the Node realm with "2nd argument is not instance of ArrayBuffer" — a
// cross-realm instanceof check. @noble/ed25519 defaults to SubtleCrypto, so
// any call to ed.getPublicKeyAsync / signAsync / verifyAsync in a jsdom test
// environment hits this. Route sha512 through Node's crypto module instead,
// which has no cross-realm constraints and produces the same digest.
//
// Scoped to libs/langgraph test-setup only — this does not affect production code
// or the published package (@cacheplane/langgraph). The @noble/ed25519 default
// remains in place for all non-test consumers.
ed.etc.sha512Async = async (...messages: Uint8Array[]): Promise<Uint8Array> => {
  const hash = createHash('sha512');
  for (const m of messages) hash.update(m);
  return new Uint8Array(hash.digest());
};

getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(),
  { teardown: { destroyAfterEach: true } },
);
