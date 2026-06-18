// SPDX-License-Identifier: MIT
/** Compile-time assertion helpers for *.type-spec.ts files (no runtime, no vitest dep). */

/** Exact-type equality (invariant). `Equal<A, B>` is `true` iff A and B are identical. */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

/** Passes only when `T` is exactly `true`; otherwise a compile error. */
export type Expect<T extends true> = T;

/** True if `A` is assignable to `B`. */
export type Assignable<A, B> = A extends B ? true : false;
