import { ApplicationConfig } from '@angular/core';
import { provideStreamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * Application configuration for the LangGraph Deployment Runtime demo.
 *
 * Uses `provideStreamResource()` to set the global LangGraph API URL.
 * In production this URL points to a LangGraph Cloud deployment.
 * All `streamResource()` calls in this app inherit this URL unless
 * overridden at the call site.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideStreamResource({
      apiUrl: environment.langGraphApiUrl,
    }),
  ],
};
