/** Loose shape check: something@something.tld. The server normalizes for real. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

export function emailError(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Enter your email address.';
  if (!EMAIL_SHAPE.test(trimmed)) return 'Enter a full address, like jordan@acme.dev.';
  return null;
}

export function requiredError(value: string, message: string): string | null {
  return value.trim().length === 0 ? message : null;
}
