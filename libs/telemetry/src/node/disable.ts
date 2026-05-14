let disabled = false;

export function disableTelemetry(): void {
  disabled = true;
}

export function isProgrammaticallyDisabled(): boolean {
  return disabled;
}

// @internal — tests only
export function _resetDisableForTesting(): void {
  disabled = false;
}
