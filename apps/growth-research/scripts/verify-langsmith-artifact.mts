import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyLangSmithArtifact } from './package-langsmith.mts';

await verifyLangSmithArtifact(resolve(dirname(fileURLToPath(import.meta.url)), '../.deployment'));
console.log('Verified staged configuration, graph paths, dependency lock and absence of environment files.');
