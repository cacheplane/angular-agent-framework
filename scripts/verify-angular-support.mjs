#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ANGULAR_PEER_RANGE,
  SUPPORTED_ANGULAR_MAJORS,
} from '../examples/chat/smoke/angular-versions.mjs';

export { ANGULAR_PEER_RANGE };

export const ANGULAR_MANIFESTS = [
  'libs/chat/package.json',
  'libs/langgraph/package.json',
  'libs/ag-ui/package.json',
  'libs/render/package.json',
  'libs/telemetry/package.json',
  'libs/cockpit-telemetry/package.json',
  'libs/example-layouts/package.json',
];

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function verifyPeerRanges({ root = process.cwd() } = {}) {
  const errors = [];

  for (const manifest of ANGULAR_MANIFESTS) {
    const manifestPath = join(root, manifest);
    let packageJson;

    try {
      packageJson = await readJson(manifestPath);
    } catch (error) {
      errors.push(
        `${relative(root, manifestPath)} could not be read: ${error.message}`
      );
      continue;
    }

    const angularPeers = Object.entries(
      packageJson.peerDependencies ?? {}
    ).filter(([name]) => name.startsWith('@angular/'));

    if (angularPeers.length === 0) {
      errors.push(
        `${manifest} must declare at least one @angular/ peer dependency.`
      );
      continue;
    }

    for (const [name, range] of angularPeers) {
      if (range !== ANGULAR_PEER_RANGE) {
        errors.push(
          `${manifest} peerDependencies["${name}"] expected "${ANGULAR_PEER_RANGE}" but found "${range}".`
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  try {
    await verifyPeerRanges();
    console.log(
      `Angular support metadata verified: ${SUPPORTED_ANGULAR_MAJORS.join(
        ', '
      )}`
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
