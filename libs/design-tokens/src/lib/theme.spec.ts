import { describe, it, expectTypeOf } from 'vitest';
import type { Theme } from './theme';

describe('Theme type', () => {
  it("accepts 'light' and 'dark'", () => {
    expectTypeOf<Theme>().toEqualTypeOf<'light' | 'dark'>();
  });
});
