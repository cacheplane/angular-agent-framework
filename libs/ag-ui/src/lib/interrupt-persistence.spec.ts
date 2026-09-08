import { describe, expect, it, vi } from 'vitest';
import { InterruptPersistence, type AgUiInterruptPersistence, type AgUiThreadRecord } from './interrupt-persistence';
import { InterruptSession } from './interrupt-session';

function memory() {
  const records = new Map<string, AgUiThreadRecord>();
  const store: AgUiInterruptPersistence['store'] = {
    async load(key) { return structuredClone(records.get(key) ?? null); },
    async compareAndSwap(key, expected, next) {
      if ((records.get(key)?.revision ?? null) !== expected) return false;
      records.set(key, structuredClone(next)); return true;
    },
  };
  return { records, config: { namespace: 'account', store } };
}
function data(phase: 'pending' | 'claimed' | 'resuming' | 'acknowledged' = 'pending') {
  const session = new InterruptSession();
  session.observeNative([{ id: 'one', reason: 'approval' }, { id: 'two', reason: 'approval' }], 'original');
  session.ready();
  if (phase !== 'pending') session.claim({ resume: [{ id: 'one', payload: true }, { id: 'two', payload: false }] }, 'attempt', 'resume-run');
  if (phase === 'resuming' || phase === 'acknowledged') session.dispatched('attempt');
  if (phase === 'acknowledged') session.acknowledge('attempt');
  return { committed: { messages: [{ id: 'm', role: 'user' as const, content: 'hello' }], state: { count: 1 } }, session: session.snapshot };
}

describe('InterruptPersistence', () => {
  it('requires nonempty scope and uses collision-free keys', async () => {
    const { config, records } = memory();
    expect(() => new InterruptPersistence({ ...config, namespace: ' ' }, 't')).toThrow();
    expect(() => new InterruptPersistence(config, '')).toThrow();
    await new InterruptPersistence({ ...config, namespace: 'a:b' }, 'c').save(data());
    await new InterruptPersistence({ ...config, namespace: 'a' }, 'b:c').save(data());
    expect([...records.keys()]).toEqual(['["a:b","c"]', '["a","b:c"]']);
  });

  it('restores committed state and the complete pending batch across restart with defensive copies', async () => {
    const { config, records } = memory();
    const input = data();
    const first = new InterruptPersistence(config, 't');
    const saving = first.save(input);
    input.committed.state.count = 9;
    await saving;
    const restarted = new InterruptPersistence(config, 't');
    const restored = await restarted.load();
    expect(restored).toMatchObject({ version: 1, namespace: 'account', threadId: 't', revision: 0, ...data() });
    if (!restored) throw new Error('Expected a persisted record');
    restored.session.interrupts.length = 0;
    expect((await restarted.load())?.session.interrupts).toHaveLength(2);
    expect(records.size).toBe(1);
  });

  it('rejects competing owners without retrying CAS', async () => {
    const { config } = memory();
    const a = new InterruptPersistence(config, 't'); const b = new InterruptPersistence(config, 't');
    await Promise.all([a.load(), b.load()]);
    const results = await Promise.allSettled([a.save(data()), b.save(data())]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    await expect(b.save(data())).rejects.toThrow(/conflict/i);
  });

  it.each(['claimed', 'resuming', 'acknowledged'] as const)('makes a crashed %s attempt require recovery', async phase => {
    const { config } = memory();
    await new InterruptPersistence(config, 't').save({ ...data(phase), resumeInput: data().committed });
    const restored = await new InterruptPersistence(config, 't').load();
    expect(restored?.session.phase).toBe(phase === 'acknowledged' ? 'recovery-required' : 'uncertain');
    expect(restored?.session.attempt?.id).toBe('attempt');
    expect(restored?.resumeInput).toEqual(data().committed);
  });

  it('allows explicit reload after conflict without silently retrying a losing save', async () => {
    const { config } = memory();
    const a = new InterruptPersistence(config, 't'); const b = new InterruptPersistence(config, 't');
    await Promise.all([a.load(), b.load()]);
    await a.save(data());
    await expect(b.save(data())).rejects.toThrow(/conflict/i);
    expect((await b.load())?.revision).toBe(0);
    await b.save(data());
    expect((await a.load())?.revision).toBe(1);
  });

  it('reconciles against the latest record after losing a compare-and-swap', async () => {
    const { config } = memory();
    const a = new InterruptPersistence(config, 't');
    const b = new InterruptPersistence({ ...config, reconcile: async record => {
      expect(record.revision).toBe(1);
      expect(record.session.phase).toBe('uncertain');
      return { status: 'pending', ...data() };
    } }, 't');
    await Promise.all([a.load(), b.load()]);
    await a.save(data()); await a.save(data('resuming'));
    await expect(b.save(data())).rejects.toThrow(/conflict/i);
    expect(await b.reconcile()).toMatchObject({ revision: 2, session: { phase: 'pending' } });
  });

  it.each([
    { version: 2 }, { namespace: 'other' }, { threadId: 'other' }, { revision: -1 },
    { revision: 1.1 }, { committed: { state: [], messages: [] } },
    { committed: { state: { value: Infinity }, messages: [] } },
    { committed: { state: {}, messages: [{ id: 'm', role: 'invalid' }] } },
    { session: { ...data().session, generation: -1 } },
    { session: { ...data().session, phase: 'invalid' } },
    { session: { ...data().session, interrupts: [{ id: '', reason: '' }] } },
    { session: { ...data().session, interrupts: [{ id: 'one', reason: '' }, { id: 'one', reason: '' }] } },
    { session: { ...data().session, interrupts: [] } },
    { session: { ...data().session, phase: 'claimed' } },
    { session: { ...data('claimed').session, attempt: { ...data('claimed').session.attempt, generation: 9 } } },
    { session: { ...data('claimed').session, attempt: { ...data('claimed').session.attempt, parameters: { resume: [{ interruptId: 'wrong', status: 'resolved' }] } } } },
  ])('rejects corrupt or mismatched records %#', async patch => {
    const { config, records } = memory();
    records.set('["account","t"]', { version: 1, namespace: 'account', threadId: 't', revision: 0, ...data(), ...patch } as AgUiThreadRecord);
    await expect(new InterruptPersistence(config, 't').load()).rejects.toThrow();
  });

  it('leaves the store untouched when recovery is unknown or missing', async () => {
    const { config, records } = memory();
    await new InterruptPersistence(config, 't').save(data('resuming'));
    const before = structuredClone([...records]);
    await expect(new InterruptPersistence(config, 't').reconcile()).rejects.toThrow('Interrupt recovery requires');
    const unknown = new InterruptPersistence({ ...config, reconcile: async () => ({ status: 'unknown' }) }, 't');
    await expect(unknown.reconcile()).rejects.toThrow('Interrupt recovery requires');
    expect([...records]).toEqual(before);
  });

  it.each(['pending', 'acknowledged', 'completed'] as const)('persists authoritative %s recovery', async status => {
    const { config } = memory();
    await new InterruptPersistence(config, 't').save(data('resuming'));
    const authoritative = status === 'completed' ? { ...data(), session: { phase: 'none' as const, generation: 1, interrupts: [] } } : data(status);
    const persistence = new InterruptPersistence({ ...config, reconcile: async record => {
      expect(record.session.phase).toBe('uncertain');
      return { status, ...authoritative };
    } }, 't');
    expect(await persistence.reconcile()).toMatchObject({ ...authoritative, revision: 1 });
    expect(await config.store.load('["account","t"]')).toMatchObject({ ...authoritative, revision: 1 });
  });

  it('persists a new paused batch when completion reinterrupts', async () => {
    const { config } = memory();
    await new InterruptPersistence(config, 't').save(data('resuming'));
    const authoritative = { ...data(), session: { ...data().session, generation: 2 } };
    const persistence = new InterruptPersistence({ ...config, reconcile: async () => ({ status: 'completed', ...authoritative }) }, 't');
    expect((await persistence.reconcile())?.session).toEqual(authoritative.session);
  });

  it('rejects completion that retains the old paused batch or attempt', async () => {
    const { config } = memory();
    await new InterruptPersistence(config, 't').save(data('resuming'));
    const persistence = new InterruptPersistence({ ...config, reconcile: async () => ({ status: 'completed', ...data() }) }, 't');
    await expect(persistence.reconcile()).rejects.toThrow();
  });

  it('retains exact replay input when authoritative pending recovery retains the attempt', async () => {
    const { config } = memory();
    const original = { ...data('resuming'), resumeInput: { messages: [], state: { optimistic: true } } };
    await new InterruptPersistence(config, 't').save(original);
    const pending = { ...original.session, phase: 'pending' as const };
    const persistence = new InterruptPersistence({ ...config, reconcile: async () => ({ status: 'pending', committed: original.committed, session: pending }) }, 't');
    expect((await persistence.reconcile())?.resumeInput).toEqual(original.resumeInput);
  });

  it.each(['pending', 'acknowledged', 'completed'] as const)('rejects inconsistent authoritative %s sessions', async status => {
    const { config, records } = memory();
    await new InterruptPersistence(config, 't').save(data('resuming'));
    const before = structuredClone([...records]);
    const session = status === 'acknowledged' ? data().session : data('resuming').session;
    const persistence = new InterruptPersistence({ ...config, reconcile: async () => ({ status, ...data(), session }) }, 't');
    await expect(persistence.reconcile()).rejects.toThrow();
    expect([...records]).toEqual(before);
  });

  it('serializes saves and continues after a reported storage failure', async () => {
    const { config } = memory();
    const compareAndSwap = vi.spyOn(config.store, 'compareAndSwap');
    compareAndSwap.mockRejectedValueOnce(new Error('disk unavailable'));
    const persistence = new InterruptPersistence(config, 't');
    await expect(persistence.save(data())).rejects.toThrow('disk unavailable');
    await Promise.all([persistence.save(data()), persistence.save(data())]);
    expect(compareAndSwap.mock.calls.map(call => call[1])).toEqual([null, null, 0]);
    expect((await persistence.load())?.revision).toBe(1);
  });
});
