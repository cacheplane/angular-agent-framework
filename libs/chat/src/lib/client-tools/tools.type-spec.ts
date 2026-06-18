// SPDX-License-Identifier: MIT
import type { Equal, Expect } from '../../testing/type-assert';

// Harness smoke — proves the type-test pipeline runs.
type _smoke = Expect<Equal<1, 1>>;
