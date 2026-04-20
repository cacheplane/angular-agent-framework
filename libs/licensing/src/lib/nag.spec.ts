// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { emitNag, __resetNagStateForTests } from './nag';

describe('emitNag', () => {
  const warn = vi.fn();

  beforeEach(() => {
    warn.mockClear();
    __resetNagStateForTests();
  });
  afterEach(() => {
    __resetNagStateForTests();
  });

  it('is silent when status is licensed', () => {
    emitNag({ status: 'licensed' }, { package: '@cacheplane/angular', warn });
    expect(warn).not.toHaveBeenCalled();
  });

  it('is silent when status is noncommercial', () => {
    emitNag({ status: 'noncommercial' }, { package: '@cacheplane/angular', warn });
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns with a stable prefix when status is missing', () => {
    emitNag({ status: 'missing' }, { package: '@cacheplane/angular', warn });
    expect(warn).toHaveBeenCalledTimes(1);
    const message = warn.mock.calls[0][0] as string;
    expect(message).toContain('[cacheplane]');
    expect(message).toContain('@cacheplane/angular');
    expect(message).toContain('cacheplane.dev/pricing');
  });

  it('warns differently for grace / expired / tampered', () => {
    emitNag({ status: 'grace' }, { package: '@cacheplane/angular', warn });
    emitNag({ status: 'expired' }, { package: '@cacheplane/render', warn });
    emitNag({ status: 'tampered' }, { package: '@cacheplane/chat', warn });
    expect(warn).toHaveBeenCalledTimes(3);
    expect(warn.mock.calls[0][0]).toMatch(/grace/i);
    expect(warn.mock.calls[1][0]).toMatch(/expired/i);
    expect(warn.mock.calls[2][0]).toMatch(/tampered|invalid/i);
  });

  it('dedupes repeated calls for the same package + status', () => {
    emitNag({ status: 'missing' }, { package: '@cacheplane/angular', warn });
    emitNag({ status: 'missing' }, { package: '@cacheplane/angular', warn });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not dedupe across different packages', () => {
    emitNag({ status: 'missing' }, { package: '@cacheplane/angular', warn });
    emitNag({ status: 'missing' }, { package: '@cacheplane/render', warn });
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
