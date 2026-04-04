// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken, Provider } from '@angular/core';
import { StreamResourceTransport } from './stream-resource.types';

/**
 * Global configuration for streamResource instances.
 * Properties set here serve as defaults that can be overridden per-call.
 */
export interface StreamResourceConfig {
  /** Base URL of the LangGraph Platform API (e.g., `'http://localhost:2024'`). */
  apiUrl?:    string;
  /** Custom transport implementation. Defaults to {@link FetchStreamTransport}. */
  transport?: StreamResourceTransport;
}

export const STREAM_RESOURCE_CONFIG =
  new InjectionToken<StreamResourceConfig>('STREAM_RESOURCE_CONFIG');

/**
 * Angular provider factory that registers global defaults for all
 * streamResource instances in the application.
 *
 * Add to your `app.config.ts` or module providers array.
 *
 * @param config - Global configuration merged with per-call options
 * @returns An Angular Provider for dependency injection
 *
 * @example
 * ```typescript
 * // app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideStreamResource({ apiUrl: 'http://localhost:2024' }),
 *   ],
 * };
 * ```
 */
export function provideStreamResource(config: StreamResourceConfig): Provider {
  return {
    provide: STREAM_RESOURCE_CONFIG,
    useValue: config,
  };
}
