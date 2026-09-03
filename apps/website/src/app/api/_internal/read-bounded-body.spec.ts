import { describe, expect, it } from 'vitest';

import { readBoundedBody } from './read-bounded-body';

describe('readBoundedBody', () => {
  it('treats a null request body as empty', async () => {
    const request = new Request('https://threadplane.ai/api/unsubscribe', {
      method: 'POST',
    });

    await expect(readBoundedBody(request, 2_048)).resolves.toBe('');
  });

  it('maps stream read failures to a rejected body result', async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('stream failed'));
      },
    });
    const request = new Request('https://threadplane.ai/api/unsubscribe', {
      method: 'POST',
      body,
      duplex: 'half',
    } as RequestInit);

    await expect(readBoundedBody(request, 2_048)).resolves.toBeNull();
    expect(request.body?.locked).toBe(false);
  });

  it('streams a body up to the exact byte cap and releases the reader', async () => {
    const encoder = new TextEncoder();
    const chunks = [encoder.encode('{"'), encoder.encode('ok":"✓"}')];
    const byteLength = chunks.reduce(
      (total, chunk) => total + chunk.byteLength,
      0
    );
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks.shift();
        if (chunk) controller.enqueue(chunk);
        else controller.close();
      },
    });
    const request = new Request('https://threadplane.ai/api/contact', {
      method: 'POST',
      body,
      duplex: 'half',
    } as RequestInit);

    await expect(readBoundedBody(request, byteLength)).resolves.toBe(
      '{"ok":"✓"}'
    );
    expect(request.body?.locked).toBe(false);
  });

  it('rejects a lying content length when the streamed bytes exceed the cap', async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('1234'));
        controller.enqueue(new TextEncoder().encode('5'));
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request('https://threadplane.ai/api/contact', {
      method: 'POST',
      headers: { 'content-length': '4' },
      body,
      duplex: 'half',
    } as RequestInit);

    await expect(readBoundedBody(request, 4)).resolves.toBeNull();
    expect(cancelled).toBe(true);
    expect(request.body?.locked).toBe(false);
  });

  it.each(['5', '-1', 'not-a-number'])(
    'rejects an invalid or oversized declared length before reading: %s',
    async (contentLength) => {
      let cancelled = false;
      const request = new Request('https://threadplane.ai/api/contact', {
        method: 'POST',
        headers: { 'content-length': contentLength },
        body: new ReadableStream<Uint8Array>({
          cancel() {
            cancelled = true;
          },
        }),
        duplex: 'half',
      } as RequestInit);

      await expect(readBoundedBody(request, 4)).resolves.toBeNull();
      expect(cancelled).toBe(true);
      expect(request.body?.locked).toBe(false);
    }
  );

  it('rejects malformed UTF-8 and releases the reader', async () => {
    const request = new Request('https://threadplane.ai/api/contact', {
      method: 'POST',
      body: new Uint8Array([0xc3, 0x28]),
      duplex: 'half',
    } as RequestInit);

    await expect(readBoundedBody(request, 2)).resolves.toBeNull();
    expect(request.body?.locked).toBe(false);
  });
});
