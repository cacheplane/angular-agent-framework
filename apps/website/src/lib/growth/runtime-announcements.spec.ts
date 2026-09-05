import { vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  selectRuntimeAnnouncements,
  type RuntimeAnnouncement,
} from './runtime-announcements';

const now = new Date('2026-09-04T12:00:00Z');
const announcement: RuntimeAnnouncement = {
  id: 'docs-range-v1',
  packageNames: ['@threadplane/langgraph'],
  minVersion: '0.0.9',
  maxVersion: '1.0.0',
  expiresAt: '2027-09-04T00:00:00Z',
  text: 'Explore the Threadplane documentation.',
  documentationUrl: 'https://threadplane.ai/docs',
};
const batch = (
  packageVersion = '0.0.65',
  packageName = '@threadplane/langgraph'
) => ({
  events: [{ properties: { packageName, packageVersion } }],
});

describe('runtime announcement catalog', () => {
  it.each([
    '@threadplane/chat',
    '@threadplane/langgraph',
    '@threadplane/ag-ui',
    '@threadplane/render',
  ])('invites supported package %s to the documentation', (packageName) => {
    expect(
      selectRuntimeAnnouncements(batch('0.0.65', packageName), now)
    ).toEqual([
      expect.objectContaining({
        documentationUrl: 'https://threadplane.ai/docs',
      }),
    ]);
  });
  it.each([
    ['0.0.8', false],
    ['0.0.9', true],
    ['0.0.10', true],
    ['0.9.99', true],
    ['1.0.0', false],
    ['2.0.0', false],
  ])(
    'applies numeric inclusive minimum and exclusive maximum for %s',
    (version, expected) => {
      expect(
        selectRuntimeAnnouncements(batch(version), now, [announcement])
      ).toHaveLength(expected ? 1 : 0);
    }
  );
  it.each([
    'unknown',
    '',
    '1',
    'v0.0.65',
    '0.0.65-beta.1',
    '0.0.65+build',
    '00.0.65',
    '0.0.9007199254740992',
  ])('omits announcements for unknown or non-release version %s', (version) => {
    expect(
      selectRuntimeAnnouncements(batch(version), now, [announcement])
    ).toEqual([]);
  });
  it('omits other packages and expired announcements including the exact expiry instant', () => {
    expect(
      selectRuntimeAnnouncements(batch('0.0.65', '@threadplane/render'), now, [
        announcement,
      ])
    ).toEqual([]);
    expect(
      selectRuntimeAnnouncements(batch(), new Date(announcement.expiresAt), [
        announcement,
      ])
    ).toEqual([]);
    expect(
      selectRuntimeAnnouncements(batch(), new Date('invalid'), [announcement])
    ).toEqual([]);
  });
  it('selects a catalog entry once across matching events and caps responses at five', () => {
    const catalog = Array.from({ length: 7 }, (_, index) => ({
      ...announcement,
      id: `docs-${index}`,
    }));
    const result = selectRuntimeAnnouncements(
      { events: [...batch().events, ...batch().events] },
      now,
      catalog
    );
    expect(result.map((item) => item.id)).toEqual([
      'docs-0',
      'docs-1',
      'docs-2',
      'docs-3',
      'docs-4',
    ]);
  });
  it('copies only public fields without sharing mutable package arrays', () => {
    const privateEntry = {
      ...announcement,
      internalNotes: 'private',
      subject: 'private',
    };
    const result = selectRuntimeAnnouncements(batch(), now, [privateEntry]);
    expect(result).toEqual([announcement]);
    expect(result[0].packageNames).not.toBe(privateEntry.packageNames);
  });
  it.each([
    { text: 'x'.repeat(501) },
    { text: '<script>alert(1)</script>' },
    { text: 'hello\u001b[31m' },
    { text: '' },
    { documentationUrl: 'http://threadplane.ai/docs' },
    { documentationUrl: 'https://threadplane.ai.evil.invalid/docs' },
    { documentationUrl: 'https://threadplane.ai/docs-elsewhere' },
    { documentationUrl: 'https://user:secret@threadplane.ai/docs' },
    { documentationUrl: 'https://threadplane.ai/docs?token=secret' },
    { minVersion: 'unknown' },
    { maxVersion: '0.0.9-beta.1' },
    { expiresAt: 'invalid' },
  ])('omits malformed or unsafe catalog entries: %j', (invalid) => {
    expect(
      selectRuntimeAnnouncements(batch(), now, [
        { ...announcement, ...invalid },
      ])
    ).toEqual([]);
  });
});
