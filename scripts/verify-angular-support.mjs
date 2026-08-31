#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ANGULAR_PEER_RANGE,
  SUPPORTED_ANGULAR_MAJORS,
} from '../examples/chat/smoke/angular-versions.mjs';
import {
  WEBSITE_ANGULAR_SUPPORT_ROWS,
  WEBSITE_PRICING_SUPPORT_SUMMARY,
  WEBSITE_SUPPORTED_ANGULAR_MAJORS,
} from '../apps/website/src/components/pricing/angular-support.mjs';

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

export async function verifyWebsiteMajors({
  websiteAngularSupportRows = WEBSITE_ANGULAR_SUPPORT_ROWS,
  websitePricingSupportSummary = WEBSITE_PRICING_SUPPORT_SUMMARY,
  websiteSupportedAngularMajors = WEBSITE_SUPPORTED_ANGULAR_MAJORS,
} = {}) {
  const errors = [];
  const expectedMajors = SUPPORTED_ANGULAR_MAJORS.join(', ');
  const actualMajors = websiteSupportedAngularMajors.join(', ');
  const expectedSupportedVersions = `Angular ${expectedMajors}`;
  const expectedPricingSupportSummary = `Angular ${SUPPORTED_ANGULAR_MAJORS.slice(
    0,
    -1
  ).join(', ')}, and ${SUPPORTED_ANGULAR_MAJORS.at(-1)} support`;

  if (
    websiteSupportedAngularMajors.length !== SUPPORTED_ANGULAR_MAJORS.length ||
    websiteSupportedAngularMajors.some(
      (major, index) => major !== SUPPORTED_ANGULAR_MAJORS[index]
    )
  ) {
    errors.push(
      `website supported Angular majors expected "${expectedMajors}" but found "${actualMajors}".`
    );
  }

  const supportedRows = websiteAngularSupportRows.filter(
    (row) => row.label === 'Supported'
  );
  const plannedRows = websiteAngularSupportRows.filter(
    (row) => row.label === 'Planned'
  );

  if (supportedRows.length !== 1) {
    errors.push(
      `website must contain exactly one Supported row but found ${supportedRows.length}.`
    );
  } else if (supportedRows[0].versions !== expectedSupportedVersions) {
    errors.push(
      `website Supported row versions expected "${expectedSupportedVersions}" but found "${supportedRows[0].versions}".`
    );
  }

  if (plannedRows.length !== 1) {
    errors.push(
      `website must contain exactly one Planned row but found ${plannedRows.length}.`
    );
  }

  if (websitePricingSupportSummary !== expectedPricingSupportSummary) {
    errors.push(
      `website pricing support summary expected "${expectedPricingSupportSummary}" but found "${websitePricingSupportSummary}".`
    );
  }

  for (const plannedRow of plannedRows) {
    for (const major of SUPPORTED_ANGULAR_MAJORS) {
      if (new RegExp(`\\b${major}\\b`).test(plannedRow.versions)) {
        errors.push(
          `website Planned row must not contain supported Angular major ${major}.`
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
    await verifyWebsiteMajors();
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
