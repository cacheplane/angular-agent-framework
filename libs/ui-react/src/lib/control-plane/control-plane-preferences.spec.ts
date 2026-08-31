import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CONTROL_PLANE_STORAGE_KEY,
  parseControlPlaneMode,
  readControlPlanePreferences,
  useControlPlanePreferences,
  writeControlPlanePreferences,
} from './control-plane-preferences';

describe('control-plane preferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('uses surface-specific defaults when storage is empty', () => {
    const preferences = readControlPlanePreferences(window.localStorage);

    expect(preferences).toEqual({
      version: 1,
      docs: { expanded: { Learn: true, Environment: false } },
      cockpit: {
        activeMode: 'Run',
        expanded: { Capability: true, Environment: true },
      },
    });
  });

  it('validates persisted values and falls back only for invalid fields', () => {
    window.localStorage.setItem(
      CONTROL_PLANE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        docs: { expanded: { Learn: false, Environment: 'yes' } },
        cockpit: {
          activeMode: 'Preview',
          expanded: { Capability: false, Environment: true, Extra: 'no' },
        },
      }),
    );

    expect(readControlPlanePreferences(window.localStorage)).toEqual({
      version: 1,
      docs: { expanded: { Learn: false, Environment: false } },
      cockpit: {
        activeMode: 'Run',
        expanded: { Capability: false, Environment: true },
      },
    });
  });

  it('falls back silently when storage access is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new DOMException('blocked');
      },
      setItem: () => {
        throw new DOMException('blocked');
      },
    };

    expect(() => readControlPlanePreferences(blocked)).not.toThrow();
    expect(() =>
      writeControlPlanePreferences(blocked, readControlPlanePreferences(blocked)),
    ).not.toThrow();
  });

  it('falls back silently when the browser storage getter is blocked', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    });

    try {
      const { result } = renderHook(() => useControlPlanePreferences('cockpit'));
      await waitFor(() => expect(result.current.hydrated).toBe(true));
      expect(result.current.activeMode).toBe('Run');
      expect(() => act(() => result.current.setActiveMode('Code'))).not.toThrow();
      expect(result.current.activeMode).toBe('Code');
    } finally {
      if (descriptor) Object.defineProperty(window, 'localStorage', descriptor);
    }
  });

  it('parses only supported cross-surface mode values', () => {
    expect(parseControlPlaneMode('run')).toBe('Run');
    expect(parseControlPlaneMode('CODE')).toBe('Code');
    expect(parseControlPlaneMode('Docs')).toBe('Docs');
    expect(parseControlPlaneMode('api')).toBe('API');
    expect(parseControlPlaneMode('preview')).toBeNull();
    expect(parseControlPlaneMode(null)).toBeNull();
  });

  it('hydrates Cockpit mode and persists mode changes without erasing Docs', async () => {
    window.localStorage.setItem(
      CONTROL_PLANE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        docs: { expanded: { Learn: false, Environment: true } },
        cockpit: {
          activeMode: 'Code',
          expanded: { Capability: true, Environment: false },
        },
      }),
    );

    const { result } = renderHook(() => useControlPlanePreferences('cockpit'));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.activeMode).toBe('Code');

    act(() => result.current.setActiveMode('API'));

    const stored = window.localStorage.getItem(CONTROL_PLANE_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? '{}')).toEqual({
      version: 1,
      docs: { expanded: { Learn: false, Environment: true } },
      cockpit: {
        activeMode: 'API',
        expanded: { Capability: true, Environment: false },
      },
    });
  });

  it('keeps Docs active and persists only its disclosure state', async () => {
    const { result } = renderHook(() => useControlPlanePreferences('docs'));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => result.current.setActiveMode('Code'));
    act(() => result.current.setExpanded('Environment', true));

    expect(result.current.activeMode).toBe('Docs');
    expect(result.current.expanded.Environment).toBe(true);
    const stored = window.localStorage.getItem(CONTROL_PLANE_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? '{}')).toEqual({
      version: 1,
      docs: { expanded: { Learn: true, Environment: true } },
      cockpit: {
        activeMode: 'Run',
        expanded: { Capability: true, Environment: true },
      },
    });
  });

  it('merges writes from concurrent hook instances without reverting newer preferences', async () => {
    const shell = renderHook(() => useControlPlanePreferences('cockpit'));
    const pane = renderHook(() => useControlPlanePreferences('cockpit'));
    await waitFor(() => {
      expect(shell.result.current.hydrated).toBe(true);
      expect(pane.result.current.hydrated).toBe(true);
    });

    act(() => shell.result.current.setActiveMode('Code'));
    act(() => pane.result.current.setExpanded('Environment', false));

    expect(JSON.parse(window.localStorage.getItem(CONTROL_PLANE_STORAGE_KEY) ?? '{}')).toEqual({
      version: 1,
      docs: { expanded: { Learn: true, Environment: false } },
      cockpit: {
        activeMode: 'Code',
        expanded: { Capability: true, Environment: false },
      },
    });
  });
});
