// SPDX-License-Identifier: MIT
import { Injectable } from '@angular/core';

const KEY = 'threadplane-ag-ui-demo:palette';

interface PaletteState {
  model: string;
  effort: string;
  genUiMode: string;
  theme: string;
  colorScheme: string;
}

type PaletteKey = keyof PaletteState;

/**
 * Tiny localStorage-backed persistence for control-palette state. Single
 * JSON object under `threadplane-ag-ui-demo:palette` so reads/writes are
 * atomic-per-key. Survives malformed JSON by returning `null` and
 * silently overwriting on next write.
 */
@Injectable({ providedIn: 'root' })
export class PalettePersistence {
  read<K extends PaletteKey>(key: K): PaletteState[K] | null {
    const raw = this.load();
    return (raw[key] as PaletteState[K] | undefined) ?? null;
  }

  write<K extends PaletteKey>(key: K, value: PaletteState[K] | null): void {
    const current = this.load();
    if (value === null || value === undefined) {
      delete current[key];
    } else {
      current[key] = value;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(current));
    } catch {
      // Storage may be full or unavailable (private mode). Silently drop;
      // the demo continues to work, just without persistence.
    }
  }

  private load(): PaletteState {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return {} as PaletteState;
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? (parsed as PaletteState) : {} as PaletteState;
    } catch {
      return {} as PaletteState;
    }
  }
}
