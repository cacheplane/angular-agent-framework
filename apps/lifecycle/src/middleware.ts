import { allow, defineMiddleware, reject } from '@dawn-ai/sdk';

import { hasExactBearerToken } from './service-auth.js';

export default defineMiddleware((request) => {
  const secret = process.env['LIFECYCLE_SERVICE_SECRET'];
  if (!hasExactBearerToken(request.headers.authorization, secret)) {
    return reject(401, { error: 'Unauthorized' });
  }
  return allow({ service: 'threadplane-website' });
});
