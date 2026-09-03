import fs from 'node:fs';
import path from 'node:path';

/**
 * Absolute path to `apps/website`, whether the process was started from the
 * workspace root (`nx build website`) or from the app itself (`next build`).
 */
export function resolveWebsiteDir(): string {
  const workspace = path.join(process.cwd(), 'apps', 'website');
  return fs.existsSync(workspace) ? workspace : process.cwd();
}
