import { portsFor } from '../../../../cockpit/ports.mjs';
const { langgraph: backend } = portsFor('cockpit-runtimes-mastra-angular');
// Backend is the deployments/ag-ui-mastra Node service, which serves
// /agent/<topic> and requires X-Internal-Token on every non-/ok route
// (matching the production contract). The dev proxy rewrites the app's
// /agent path to the mastra topic and injects the dev token — start the
// service with the same AG_UI_INTERNAL_TOKEN value (default
// 'dev-local-token'; see deployments/ag-ui-mastra/README.md).
export default {
  '/agent': {
    target: `http://localhost:${backend}`,
    secure: false,
    changeOrigin: true,
    ws: true,
    pathRewrite: { '^/agent': '/agent/mastra' },
    headers: { 'X-Internal-Token': process.env.AG_UI_INTERNAL_TOKEN ?? 'dev-local-token' },
  },
};
