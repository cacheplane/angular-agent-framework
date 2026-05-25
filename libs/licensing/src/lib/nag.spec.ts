// SPDX-License-Identifier: MIT
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
    emitNag({ status: 'licensed' }, { package: '@threadplane/langgraph', warn });
    expect(warn).not.toHaveBeenCalled();
  });

  it('is silent when status is noncommercial', () => {
    emitNag({ status: 'noncommercial' }, { package: '@threadplane/langgraph', warn });
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns with a stable prefix when status is missing', () => {
    emitNag({ status: 'missing' }, { package: '@threadplane/langgraph', warn });
    expect(warn).toHaveBeenCalledTimes(1);
    const message = warn.mock.calls[0][0] as string;
    expect(message).toContain('[threadplane]');
    expect(message).toContain('@threadplane/langgraph');
    expect(message).toContain('threadplane.ai/pricing');
  });

  it('warns differently for grace / expired / tampered', () => {
    emitNag({ status: 'grace' }, { package: '@threadplane/langgraph', warn });
    emitNag({ status: 'expired' }, { package: '@threadplane/render', warn });
    emitNag({ status: 'tampered' }, { package: '@threadplane/chat', warn });
    expect(warn).toHaveBeenCalledTimes(3);
    expect(warn.mock.calls[0][0]).toMatch(/grace/i);
    expect(warn.mock.calls[1][0]).toMatch(/expired/i);
    expect(warn.mock.calls[2][0]).toMatch(/tampered|invalid/i);
  });

  it('dedupes repeated calls for the same package + status', () => {
    emitNag({ status: 'missing' }, { package: '@threadplane/langgraph', warn });
    emitNag({ status: 'missing' }, { package: '@threadplane/langgraph', warn });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not dedupe across different packages', () => {
    emitNag({ status: 'missing' }, { package: '@threadplane/langgraph', warn });
    emitNag({ status: 'missing' }, { package: '@threadplane/render', warn });
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
