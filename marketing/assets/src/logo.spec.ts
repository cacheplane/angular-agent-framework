import { describe, expect, it } from 'vitest';
import { loadPlaneDataUri } from './logo';

describe('loadPlaneDataUri', () => {
  it('returns a base64 png data URI', async () => {
    const uri = await loadPlaneDataUri();
    expect(uri.startsWith('data:image/png;base64,')).toBe(true);
    const b64 = uri.slice('data:image/png;base64,'.length);
    const bytes = Buffer.from(b64, 'base64');
    // PNG magic number
    expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('memoizes — second call returns the same string reference', async () => {
    const a = await loadPlaneDataUri();
    const b = await loadPlaneDataUri();
    expect(a).toBe(b);
  });
});
