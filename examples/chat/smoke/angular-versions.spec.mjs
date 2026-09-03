import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANGULAR_LANES,
  ANGULAR_PEER_RANGE,
  SUPPORTED_ANGULAR_MAJORS,
  getAngularLane,
} from './angular-versions.mjs';

test('defines the supported Angular majors and peer range', () => {
  assert.deepEqual(SUPPORTED_ANGULAR_MAJORS, [20, 21, 22]);
  assert.equal(ANGULAR_PEER_RANGE, '^20.0.0 || ^21.0.0 || ^22.0.0');
});

test('defines the exact dependency and toolchain pins for every lane', () => {
  assert.deepEqual(ANGULAR_LANES, {
    20: {
      major: 20,
      node: '22.22.3',
      dependencies: {
        '@angular/common': '20.3.30',
        '@angular/compiler': '20.3.30',
        '@angular/core': '20.3.30',
        '@angular/forms': '20.3.30',
        '@angular/platform-browser': '20.3.30',
        '@angular/router': '20.3.30',
        '@angular/cdk': '20.2.14',
        '@angular/google-maps': '20.2.14',
      },
      devDependencies: {
        '@angular/build': '20.3.35',
        '@angular/cli': '20.3.35',
        '@angular/compiler-cli': '20.3.30',
        typescript: '5.9.3',
      },
    },
    21: {
      major: 21,
      node: '22.22.3',
      dependencies: {
        '@angular/common': '21.2.22',
        '@angular/compiler': '21.2.22',
        '@angular/core': '21.2.22',
        '@angular/forms': '21.2.22',
        '@angular/platform-browser': '21.2.22',
        '@angular/router': '21.2.22',
        '@angular/cdk': '21.2.14',
        '@angular/google-maps': '21.2.14',
      },
      devDependencies: {
        '@angular/build': '21.2.22',
        '@angular/cli': '21.2.22',
        '@angular/compiler-cli': '21.2.22',
        typescript: '5.9.3',
      },
    },
    22: {
      major: 22,
      node: '22.22.3',
      dependencies: {
        '@angular/common': '22.1.4',
        '@angular/compiler': '22.1.4',
        '@angular/core': '22.1.4',
        '@angular/forms': '22.1.4',
        '@angular/platform-browser': '22.1.4',
        '@angular/router': '22.1.4',
        '@angular/cdk': '22.1.4',
        '@angular/google-maps': '22.1.4',
      },
      devDependencies: {
        '@angular/build': '22.1.6',
        '@angular/cli': '22.1.6',
        '@angular/compiler-cli': '22.1.4',
        typescript: '6.0.3',
      },
    },
  });
});

test('freezes the registry and every lane configuration object', () => {
  assert.ok(Object.isFrozen(SUPPORTED_ANGULAR_MAJORS));
  assert.ok(Object.isFrozen(ANGULAR_LANES));

  for (const major of SUPPORTED_ANGULAR_MAJORS) {
    const lane = ANGULAR_LANES[major];
    assert.ok(Object.isFrozen(lane));
    assert.ok(Object.isFrozen(lane.dependencies));
    assert.ok(Object.isFrozen(lane.devDependencies));
  }
});

test('selects each supported lane from numeric and string majors', () => {
  for (const major of SUPPORTED_ANGULAR_MAJORS) {
    assert.strictEqual(getAngularLane(major), ANGULAR_LANES[major]);
    assert.strictEqual(getAngularLane(String(major)), ANGULAR_LANES[major]);
  }
});

test('rejects unsupported Angular majors', () => {
  assert.throws(
    () => getAngularLane('23'),
    new Error('Unsupported Angular major 23. Expected one of: 20, 21, 22')
  );
});
