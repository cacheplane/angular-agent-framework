// SPDX-License-Identifier: MIT
export interface CaptureGuardInput {
  token: string | undefined;
  captureLocal: boolean;
  host: string | undefined;
  doNotTrack: boolean;
}

export function shouldCaptureAnalytics(input: CaptureGuardInput): boolean {
  if (!input.token) return false;
  if (input.doNotTrack) return false;
  if (!input.captureLocal && isLocalhost(input.host)) return false;
  return true;
}

export function isLocalhost(host: string | undefined): boolean {
  if (!host) return false;
  return (
    host === 'localhost' ||
    host.startsWith('localhost:') ||
    host.startsWith('127.0.0.1') ||
    host.startsWith('0.0.0.0')
  );
}
