// SPDX-License-Identifier: MIT

/** A geographic bounding box (LatLngBoundsLiteral-compatible). */
export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Smallest box containing every stop that has coordinates, or null if none do. */
export function computeBounds(
  stops: ReadonlyArray<{ lat?: number | null; lng?: number | null }>,
): Bounds | null {
  let north = -Infinity, south = Infinity, east = -Infinity, west = Infinity;
  let found = false;
  for (const s of stops) {
    if (s.lat == null || s.lng == null) continue;
    found = true;
    north = Math.max(north, s.lat);
    south = Math.min(south, s.lat);
    east = Math.max(east, s.lng);
    west = Math.min(west, s.lng);
  }
  return found ? { north, south, east, west } : null;
}
