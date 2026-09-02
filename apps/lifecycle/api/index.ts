import dawnApp from '../.dawn/build/app.mjs';
import { createLifecycleVercelAdapter } from '../src/vercel-adapter.js';

export default createLifecycleVercelAdapter(dawnApp);
