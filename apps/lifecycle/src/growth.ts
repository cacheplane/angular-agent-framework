// Keep the runtime dependency on the workspace library relative so Vercel's
// function tracer emits and resolves the compiled JavaScript copy.
// eslint-disable-next-line @nx/enforce-module-boundaries -- the relative edge is required in the emitted Vercel function
export * from '../../../libs/growth/src/index.js';
