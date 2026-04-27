/**
 * Development environment configuration.
 *
 * Points to a local AG-UI compatible agent server started on port 3000.
 * The dev-server proxy (proxy.conf.json) forwards /agent to http://localhost:3000.
 */
export const environment = {
  production: false,
  agUiUrl: 'http://localhost:3000/agent',
};
