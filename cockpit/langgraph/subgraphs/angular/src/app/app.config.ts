import { ApplicationConfig } from '@angular/core';
import { provideStreamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * Application configuration for the LangGraph Subgraphs demo.
 *
 * Uses `provideStreamResource()` to set the global LangGraph API URL.
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
