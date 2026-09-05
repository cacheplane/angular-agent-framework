'use strict';
const fs = require('node:fs/promises');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const moduleSource = (token) =>
  `export const installationToken = ${JSON.stringify(token)};\n`;

// Rename publishes a complete module. Failure never affects npm installation.
async function writeBridge(packageRoot, token) {
  const directory = join(packageRoot, '.install-collector');
  const destination = join(directory, 'development-install.mjs');
  let temporary;
  try {
    await fs.mkdir(directory, { recursive: true });
    if (!(await fs.lstat(directory)).isDirectory()) return false;
    const existing = await fs.lstat(destination).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
      return undefined;
    });
    if (existing && !existing.isFile()) return false;
    temporary = join(directory, `.development-install-${randomUUID()}.tmp`);
    await fs.writeFile(temporary, moduleSource(token), {
      flag: 'wx',
      mode: 0o644,
    });
    await fs.rename(temporary, destination);
    return true;
  } catch {
    return false;
  } finally {
    if (temporary) await fs.unlink(temporary).catch(() => undefined);
  }
}
module.exports = { moduleSource, writeBridge };
