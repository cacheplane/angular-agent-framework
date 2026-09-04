import { describe, expect, it } from 'vitest';
import { emailError, requiredError } from './validators';

describe('validators', () => {
  it('emailError names the fix and accepts a full address', () => {
    expect(emailError('')).toBe('Enter your email address.');
    expect(emailError('jordan@acme')).toBe('Enter a full address, like jordan@acme.dev.');
    expect(emailError('jordan@acme.dev')).toBeNull();
    expect(emailError('  jordan@acme.dev ')).toBeNull();
  });

  it('requiredError uses the supplied message only when the value is blank', () => {
    expect(requiredError('', 'Choose a timeline so we can route this.')).toBe('Choose a timeline so we can route this.');
    expect(requiredError('   ', 'Choose a timeline so we can route this.')).toBe('Choose a timeline so we can route this.');
    expect(requiredError('this_quarter', 'Choose a timeline so we can route this.')).toBeNull();
  });
});
