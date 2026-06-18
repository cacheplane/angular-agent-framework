// SPDX-License-Identifier: MIT
/** Compile-time assertion helpers for *.type-spec.ts files (no runtime). */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
export type Expect<T extends true> = T;
