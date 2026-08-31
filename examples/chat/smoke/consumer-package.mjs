// SPDX-License-Identifier: MIT

export function applyAngularLane(packageJson, selectedLane) {
  return {
    ...packageJson,
    dependencies: {
      ...packageJson.dependencies,
      ...selectedLane.dependencies,
    },
    devDependencies: {
      ...packageJson.devDependencies,
      ...selectedLane.devDependencies,
    },
  };
}

export function strictNpmEnv(base = process.env) {
  return {
    ...base,
    npm_config_legacy_peer_deps: 'false',
    NPM_CONFIG_LEGACY_PEER_DEPS: 'false',
  };
}
