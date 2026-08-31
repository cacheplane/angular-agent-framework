'use client';

import { useCallback, useEffect, useState } from 'react';

export type ControlPlaneMode = 'Docs' | 'Run' | 'Code' | 'API';
export type ControlPlaneSurface = 'docs' | 'cockpit';

export interface ControlPlanePreferencesV1 {
  version: 1;
  docs: {
    expanded: Record<string, boolean>;
  };
  cockpit: {
    activeMode: ControlPlaneMode;
    expanded: Record<string, boolean>;
  };
}

export const CONTROL_PLANE_STORAGE_KEY = 'threadplane:control-plane:v1';

const DEFAULT_PREFERENCES: ControlPlanePreferencesV1 = {
  version: 1,
  docs: { expanded: { Learn: true, Environment: false } },
  cockpit: {
    activeMode: 'Run',
    expanded: { Capability: true, Environment: true },
  },
};

const MODES: readonly ControlPlaneMode[] = ['Docs', 'Run', 'Code', 'API'];

const cloneDefaults = (): ControlPlanePreferencesV1 => ({
  version: 1,
  docs: { expanded: { ...DEFAULT_PREFERENCES.docs.expanded } },
  cockpit: {
    activeMode: DEFAULT_PREFERENCES.cockpit.activeMode,
    expanded: { ...DEFAULT_PREFERENCES.cockpit.expanded },
  },
});

const getBrowserStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const booleanRecord = (
  value: unknown,
  defaults: Record<string, boolean>,
): Record<string, boolean> => {
  const result = { ...defaults };
  if (!isRecord(value)) return result;
  for (const [key, candidate] of Object.entries(value)) {
    if (typeof candidate === 'boolean') result[key] = candidate;
  }
  return result;
};

const isMode = (value: unknown): value is ControlPlaneMode =>
  typeof value === 'string' && MODES.includes(value as ControlPlaneMode);

export const parseControlPlaneMode = (value: string | null): ControlPlaneMode | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  return MODES.find((mode) => mode.toLowerCase() === normalized) ?? null;
};

export const readControlPlanePreferences = (
  storage: Pick<Storage, 'getItem'>,
): ControlPlanePreferencesV1 => {
  const defaults = cloneDefaults();
  try {
    const raw = storage.getItem(CONTROL_PLANE_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) return defaults;

    const docs = isRecord(parsed.docs) ? parsed.docs : {};
    const cockpit = isRecord(parsed.cockpit) ? parsed.cockpit : {};
    return {
      version: 1,
      docs: {
        expanded: booleanRecord(docs.expanded, defaults.docs.expanded),
      },
      cockpit: {
        activeMode: isMode(cockpit.activeMode)
          ? cockpit.activeMode
          : defaults.cockpit.activeMode,
        expanded: booleanRecord(cockpit.expanded, defaults.cockpit.expanded),
      },
    };
  } catch {
    return defaults;
  }
};

export const writeControlPlanePreferences = (
  storage: Pick<Storage, 'setItem'>,
  value: ControlPlanePreferencesV1,
): void => {
  try {
    storage.setItem(CONTROL_PLANE_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Preferences are progressive enhancement; blocked storage is non-fatal.
  }
};

export function useControlPlanePreferences(surface: ControlPlaneSurface) {
  const [preferences, setPreferences] = useState<ControlPlanePreferencesV1>(cloneDefaults);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storage = getBrowserStorage();
    setPreferences(storage ? readControlPlanePreferences(storage) : cloneDefaults());
    setHydrated(true);
  }, []);

  const update = useCallback(
    (recipe: (current: ControlPlanePreferencesV1) => ControlPlanePreferencesV1) => {
      setPreferences((current) => {
        const storage = getBrowserStorage();
        const base = hydrated && storage
          ? readControlPlanePreferences(storage)
          : current;
        const next = recipe(base);
        if (hydrated && storage) writeControlPlanePreferences(storage, next);
        return next;
      });
    },
    [hydrated],
  );

  const setActiveMode = useCallback(
    (activeMode: ControlPlaneMode) => {
      if (surface === 'docs') return;
      update((current) => ({
        ...current,
        cockpit: { ...current.cockpit, activeMode },
      }));
    },
    [surface, update],
  );

  const setExpanded = useCallback(
    (section: string, open: boolean) => {
      update((current) =>
        surface === 'docs'
          ? {
              ...current,
              docs: {
                ...current.docs,
                expanded: { ...current.docs.expanded, [section]: open },
              },
            }
          : {
              ...current,
              cockpit: {
                ...current.cockpit,
                expanded: { ...current.cockpit.expanded, [section]: open },
              },
            },
      );
    },
    [surface, update],
  );

  return {
    hydrated,
    activeMode: surface === 'docs' ? ('Docs' as const) : preferences.cockpit.activeMode,
    expanded: preferences[surface].expanded,
    setActiveMode,
    setExpanded,
  };
}
