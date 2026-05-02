// libs/chat/src/lib/streaming/trace.ts
// SPDX-License-Identifier: MIT
//
// localStorage / window-flag-gated debug tracer for @ngaf/chat streaming.
// Off by default. Enable via:
//   window.__ngafChatTrace = true
//   localStorage.NGAF_CHAT_STREAM_TRACE = '1'
//
// All call sites should be guarded with `if (isTraceEnabled())` so the
// argument-collection cost is paid only when tracing is on.

export function isTraceEnabled(): boolean {
  if (typeof globalThis === 'undefined') return false;
  const win = (globalThis as { window?: { __ngafChatTrace?: boolean; localStorage?: Storage } }).window;
  if (!win) return false;
  if (win.__ngafChatTrace === true) return true;
  try {
    return win.localStorage?.getItem('NGAF_CHAT_STREAM_TRACE') === '1';
  } catch {
    return false;
  }
}

export function trace(...args: unknown[]): void {
  if (isTraceEnabled()) {
    // eslint-disable-next-line no-console
    console.debug('[ngaf-chat-stream]', ...args);
  }
}
