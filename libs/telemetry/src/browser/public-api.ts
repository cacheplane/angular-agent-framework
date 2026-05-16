export { provideNgafTelemetry } from './provide';
export { NgafTelemetryService } from './service';
export { NGAF_TELEMETRY_CONFIG } from './tokens';
export type {
  NgafTelemetryConfig,
  NgafTelemetryEvent,
  NgafTelemetryEventPayload,
  NgafTelemetrySink,
} from './tokens';
export type {
  NgafBrowserEvent,
  NgafBrowserRuntimeTelemetry,
  NgafBrowserStreamErrorTelemetry,
  NgafBrowserStreamTelemetry,
} from './service';
export { isLocalAnalyticsHost, shouldCaptureAnalytics } from './properties';
export type { CaptureConfig } from './properties';
