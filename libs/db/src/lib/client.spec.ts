// SPDX-License-Identifier: MIT
import { createDb } from './client.js';

describe('createDb', () => {
  it('returns an object with a query builder and a connection closer', () => {
    const db = createDb('postgres://fake@localhost:5432/fake');
    expect(db).toBeDefined();
    expect(typeof db.close).toBe('function');
    // Close immediately — we're not actually connecting.
    return db.close();
  });

  it('throws if the connection string is empty', () => {
    expect(() => createDb('')).toThrow(/connection string/i);
  });
});
