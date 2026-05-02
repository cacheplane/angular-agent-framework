import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { verifyReleaseVersions } from './verify-release-versions.mjs';

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function createWorkspace(projectVersions) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'ngaf-release-versions-'));
  const projects = Object.keys(projectVersions);

  await writeJson(join(workspaceRoot, 'nx.json'), {
    release: {
      groups: {
        publishable: {
          projects,
          projectsRelationship: 'fixed',
        },
      },
    },
  });

  for (const [projectName, version] of Object.entries(projectVersions)) {
    const projectRoot = join(workspaceRoot, 'libs', projectName);
    await mkdir(projectRoot, { recursive: true });
    await writeJson(join(projectRoot, 'project.json'), {
      name: projectName,
    });
    await writeJson(join(projectRoot, 'package.json'), {
      name: `@ngaf/${projectName}`,
      version,
    });
  }

  return workspaceRoot;
}

describe('verifyReleaseVersions', () => {
  it('accepts a fixed release group where every package shares the same version', async () => {
    const workspaceRoot = await createWorkspace({
      chat: '0.0.13',
      langgraph: '0.0.13',
      render: '0.0.13',
    });

    await expect(
      verifyReleaseVersions({ workspaceRoot, expectedTag: 'v0.0.13' })
    ).resolves.toEqual({
      version: '0.0.13',
      packages: ['@ngaf/chat', '@ngaf/langgraph', '@ngaf/render'],
    });
  });

  it('rejects release groups with mixed package versions', async () => {
    const workspaceRoot = await createWorkspace({
      chat: '0.0.13',
      langgraph: '0.0.12',
      render: '0.0.13',
    });

    await expect(
      verifyReleaseVersions({ workspaceRoot, expectedTag: 'v0.0.13' })
    ).rejects.toThrow(
      'Release group "publishable" must publish atomically with one uniform version.'
    );
  });

  it('rejects a release tag that does not match the uniform package version', async () => {
    const workspaceRoot = await createWorkspace({
      chat: '0.0.13',
      langgraph: '0.0.13',
      render: '0.0.13',
    });

    await expect(
      verifyReleaseVersions({ workspaceRoot, expectedTag: 'v0.0.12' })
    ).rejects.toThrow(
      'Release tag v0.0.12 does not match package version 0.0.13.'
    );
  });

  it('rejects public packages that are missing from the release group', async () => {
    const workspaceRoot = await createWorkspace({
      chat: '0.0.13',
      langgraph: '0.0.13',
    });
    const projectRoot = join(workspaceRoot, 'libs', 'render');
    await mkdir(projectRoot, { recursive: true });
    await writeJson(join(projectRoot, 'project.json'), {
      name: 'render',
      targets: {
        'nx-release-publish': {
          options: {
            packageRoot: 'dist/libs/render',
          },
        },
      },
    });
    await writeJson(join(projectRoot, 'package.json'), {
      name: '@ngaf/render',
      version: '0.0.13',
    });

    await expect(verifyReleaseVersions({ workspaceRoot })).rejects.toThrow(
      'Public package @ngaf/render is not included in release group "publishable".'
    );
  });
});
