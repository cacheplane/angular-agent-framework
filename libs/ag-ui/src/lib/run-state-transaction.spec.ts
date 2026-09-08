import { it, expect } from 'vitest';
import { RunStateTransaction } from './run-state-transaction';

it('keeps a paused committed snapshot separate from an optimistic resume draft', () => {
  const transaction = new RunStateTransaction({ state: { approved: false }, messages: [] });
  transaction.commit({ state: { approved: false, paused: true }, messages: [] });
  const draft = transaction.begin();
  draft.state['approved'] = true;
  expect(transaction.committed.state).toEqual({ approved: false, paused: true });
  expect(transaction.rollback()).toEqual(transaction.committed);
});

it('commits replacement snapshots without retaining removed keys or mutable references', () => {
  const transaction = new RunStateTransaction({ state: { old: 1 }, messages: [] });
  const next = { state: { new: { value: 2 } }, messages: [] };
  transaction.commit(next);
  next.state.new.value = 9;
  const copy = transaction.committed;
  copy.state['extra'] = true;
  expect(transaction.committed.state).toEqual({ new: { value: 2 } });
});
