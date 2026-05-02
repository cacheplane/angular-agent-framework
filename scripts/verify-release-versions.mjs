#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const SKIPPED_DIRECTORIES = new Set([
  '.git',
  '.nx',
  'coverage',
  'dist',
  'node_modules',
  'tmp',
]);

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function* walkProjectJsonFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        yield* walkProjectJsonFiles(join(directory, entry.name));
      }
      continue;
    }

    if (entry.isFile() && entry.name === 'project.json') {
      yield join(directory, entry.name);
    }
  }
}

async function findProjects(workspaceRoot) {
  const projects = new Map();

  for await (const projectJsonPath of walkProjectJsonFiles(workspaceRoot)) {
    const project = await readJson(projectJsonPath);
    if (typeof project.name === 'string') {
      projects.set(project.name, {
        name: project.name,
        root: projectJsonPath.slice(0, -'/project.json'.length),
        targets: project.targets ?? {},
      });
    }
  }

  return projects;
}

async function getPackageForProject(workspaceRoot, project) {
  const packageJsonPath = join(project.root, 'package.json');
  const packageJson = await readJson(packageJsonPath);

  return {
    packageJson,
    packageJsonPath,
    packageName: packageJson.name,
    projectName: project.name,
    version: packageJson.version,
  };
}

function normalizeTag(tag) {
  if (!tag) {
    return undefined;
  }

  return tag.replace(/^refs\/tags\//, '');
}

export async function verifyReleaseVersions({
  workspaceRoot = process.cwd(),
  groupName = 'publishable',
  expectedTag,
} = {}) {
  const nxJson = await readJson(join(workspaceRoot, 'nx.json'));
  const releaseGroup = nxJson.release?.groups?.[groupName];

  if (!releaseGroup) {
    throw new Error(
      `Release group "${groupName}" is not configured in nx.json.`
    );
  }

  if (releaseGroup.projectsRelationship !== 'fixed') {
    throw new Error(
      `Release group "${groupName}" must use projectsRelationship "fixed" for atomic releases.`
    );
  }

  const projectNames = releaseGroup.projects;
  if (!Array.isArray(projectNames) || projectNames.length === 0) {
    throw new Error(`Release group "${groupName}" does not list any projects.`);
  }

  const projects = await findProjects(workspaceRoot);
  const releaseProjectNames = new Set(projectNames);
  const omittedPublicPackages = [];

  for (const project of projects.values()) {
    let packageInfo;

    try {
      packageInfo = await getPackageForProject(workspaceRoot, project);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        continue;
      }
      throw error;
    }

    if (
      packageInfo.packageJson.private !== true &&
      typeof packageInfo.packageName === 'string' &&
      packageInfo.packageName.startsWith('@ngaf/') &&
      project.targets['nx-release-publish'] &&
      !releaseProjectNames.has(project.name)
    ) {
      omittedPublicPackages.push(packageInfo.packageName);
    }
  }

  if (omittedPublicPackages.length > 0) {
    omittedPublicPackages.sort((a, b) => a.localeCompare(b));
    throw new Error(
      omittedPublicPackages
        .map(
          (packageName) =>
            `Public package ${packageName} is not included in release group "${groupName}".`
        )
        .join('\n')
    );
  }

  const packages = [];

  for (const projectName of projectNames) {
    const project = projects.get(projectName);
    if (!project) {
      throw new Error(
        `Release project "${projectName}" does not have a project.json.`
      );
    }

    const packageInfo = await getPackageForProject(workspaceRoot, project);

    if (packageInfo.packageJson.private === true) {
      throw new Error(
        `Release project "${projectName}" points at private package ${relative(
          workspaceRoot,
          packageInfo.packageJsonPath
        )}.`
      );
    }

    if (
      typeof packageInfo.packageName !== 'string' ||
      typeof packageInfo.version !== 'string'
    ) {
      throw new Error(
        `Release project "${projectName}" must have package name and version in ${relative(
          workspaceRoot,
          packageInfo.packageJsonPath
        )}.`
      );
    }

    packages.push({
      packageName: packageInfo.packageName,
      projectName: packageInfo.projectName,
      version: packageInfo.version,
    });
  }

  packages.sort((a, b) => a.packageName.localeCompare(b.packageName));

  const versions = new Set(packages.map((pkg) => pkg.version));
  if (versions.size !== 1) {
    const packageList = packages
      .map((pkg) => `  - ${pkg.packageName}: ${pkg.version}`)
      .join('\n');

    throw new Error(
      `Release group "${groupName}" must publish atomically with one uniform version.\n${packageList}`
    );
  }

  const [version] = versions;
  const tag = normalizeTag(expectedTag);

  if (tag && tag !== `v${version}`) {
    throw new Error(
      `Release tag ${tag} does not match package version ${version}.`
    );
  }

  return {
    version,
    packages: packages.map((pkg) => pkg.packageName),
  };
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--group') {
      options.groupName = argv[index + 1];
      index += 1;
    } else if (arg === '--tag') {
      options.expectedTag = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await verifyReleaseVersions(
      parseArgs(process.argv.slice(2))
    );
    console.log(
      `Release group "publishable" is atomic at ${
        result.version
      }: ${result.packages.join(', ')}`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
