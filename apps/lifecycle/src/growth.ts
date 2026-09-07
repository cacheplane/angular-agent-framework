// Keep the runtime dependency relative so Dawn's native Vercel bundler
// includes the workspace library in the closed function artifact.
// eslint-disable-next-line @nx/enforce-module-boundaries -- the relative edge is required in the emitted Vercel function
export * from '../../../libs/growth/src/index.js';
