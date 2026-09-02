export type RuntimeBridgeFault =
  | 'none'
  | 'child-ready-loss'
  | 'configured-ack-loss'
  | 'wrong-version';

export function renderRuntimeBridgeFrame(
  fault: RuntimeBridgeFault = 'none'
): string {
  const encodedFault = JSON.stringify(fault);
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Runtime bridge fixture</title></head>
<body><p>Runtime bridge fixture</p><script>
(() => {
  const fault = ${encodedFault};
  const parentOrigin = new URL(document.referrer).origin;
  const nonce = crypto.randomUUID();
  const post = (message) => parent.postMessage(message, parentOrigin);
  if (fault !== 'child-ready-loss') {
    post({ type: 'tplane:runtime-child-ready', version: 2, nonce });
  }
  addEventListener('message', (event) => {
    if (event.source !== parent || event.origin !== parentOrigin) return;
    const message = event.data;
    if (message?.type === 'tplane:runtime-configure' && message.nonce === nonce) {
      if (fault === 'configured-ack-loss') return;
      post({
        type: 'tplane:runtime-configured',
        version: fault === 'wrong-version' ? 999 : 2,
        nonce,
        generation: message.generation,
      });
      return;
    }
    if (message?.type === 'tplane:runtime-check' && message.version === 1) {
      post({ type: 'tplane:runtime-ready', version: 1, nonce: message.nonce });
    }
  });
})();
</script></body></html>`;
}
