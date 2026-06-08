import { describe, expect, it } from 'vitest';
import { renderCard } from './render';

function readPngDimensions(buf: Buffer): { width: number; height: number } {
  // PNG IHDR: width = bytes 16-19 big-endian, height = 20-23.
  expect([...buf.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('renderCard', () => {
  it('renders an x-card at 1200x675', async () => {
    const card = await renderCard({ template: 'x-card', title: 'Hello world' });
    expect(card.contentType).toBe('image/png');
    expect(card.png.byteLength).toBeGreaterThan(1000);
    expect(readPngDimensions(card.png)).toEqual({ width: 1200, height: 675 });
    expect(card.width).toBe(1200);
    expect(card.height).toBe(675);
  });

  it('renders an og-card at 1200x630', async () => {
    const card = await renderCard({ template: 'og-card', title: 'Hello world' });
    expect(readPngDimensions(card.png)).toEqual({ width: 1200, height: 630 });
  });

  it('renders with a subtitle', async () => {
    const card = await renderCard({
      template: 'x-card',
      title: 'Streaming chat in Angular',
      subtitle: 'A signal-native tutorial with LangGraph.',
    });
    expect(card.png.byteLength).toBeGreaterThan(1000);
  });

  it('renders with an author (replaces trust pills)', async () => {
    const card = await renderCard({
      template: 'og-card',
      title: 'Build agent UI',
      author: { name: 'Brian Love', role: 'Founder' },
    });
    expect(card.png.byteLength).toBeGreaterThan(1000);
  });

  it('renders title-only (default eyebrow + trust pills path)', async () => {
    const card = await renderCard({ template: 'og-card', title: 'Just a title' });
    expect(card.png.byteLength).toBeGreaterThan(1000);
  });

  it('throws on unknown template id', async () => {
    await expect(
      // @ts-expect-error testing runtime guard with an invalid id
      renderCard({ template: 'nope', title: 'x' }),
    ).rejects.toThrow(/Unknown template "nope"/);
  });
});
