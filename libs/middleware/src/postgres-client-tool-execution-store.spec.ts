// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import {
  THREADPLANE_CLIENT_TOOL_EXECUTIONS_SCHEMA,
  createPostgresClientToolExecutionStore,
  type PostgresTaggedSql,
} from './langgraph/postgres-client-tool-execution-store';

function makeSql(rows: unknown[][]): { sql: PostgresTaggedSql; queries: string[]; values: unknown[][] } {
  const queries: string[] = [];
  const values: unknown[][] = [];
  const sql = (async (strings: TemplateStringsArray, ...params: unknown[]) => {
    queries.push(strings.join('?'));
    values.push(params);
    return rows.shift() ?? [];
  }) as PostgresTaggedSql;
  return { sql, queries, values };
}

describe('THREADPLANE_CLIENT_TOOL_EXECUTIONS_SCHEMA', () => {
  it('creates the client-tool execution table with first-ship single-tenant primary key', () => {
    expect(THREADPLANE_CLIENT_TOOL_EXECUTIONS_SCHEMA).toContain('CREATE TABLE');
    expect(THREADPLANE_CLIENT_TOOL_EXECUTIONS_SCHEMA).toContain('threadplane_client_tool_executions');
    expect(THREADPLANE_CLIENT_TOOL_EXECUTIONS_SCHEMA).toContain('tenant_id');
    expect(THREADPLANE_CLIENT_TOOL_EXECUTIONS_SCHEMA).toContain('PRIMARY KEY (thread_id, tool_call_id)');
  });
});

describe('createPostgresClientToolExecutionStore', () => {
  it('claims a new execution with ON CONFLICT DO NOTHING', async () => {
    const { sql, queries, values } = makeSql([[{ status: 'executing', result: null }]]);
    const store = createPostgresClientToolExecutionStore(sql, { tenantId: 'tenant-1' });

    await expect(store.claim({ threadId: 'thread-1', toolCallId: 'call-1' })).resolves.toBe('claimed');

    expect(queries[0]).toContain('ON CONFLICT (thread_id, tool_call_id) DO NOTHING');
    expect(values[0]).toEqual(['tenant-1', 'thread-1', 'call-1']);
  });

  it('reads the existing row when claim conflicts', async () => {
    const { sql } = makeSql([
      [],
      [{ status: 'done', result: { ok: true, value: { temp: 72 } } }],
    ]);
    const store = createPostgresClientToolExecutionStore(sql);

    await expect(store.claim({ threadId: 'thread-1', toolCallId: 'call-1' })).resolves.toEqual({
      status: 'done',
      result: { ok: true, value: { temp: 72 } },
    });
  });

  it('records a done result without overwriting an already-done result', async () => {
    const { sql, queries, values } = makeSql([[]]);
    const store = createPostgresClientToolExecutionStore(sql);
    const result = { ok: false as const, error: 'boom' };

    await store.record({ threadId: 'thread-1', toolCallId: 'call-1' }, result);

    expect(queries[0]).toContain('ON CONFLICT (thread_id, tool_call_id) DO UPDATE');
    expect(queries[0]).toContain('WHEN threadplane_client_tool_executions.status =');
    expect(values[0]).toEqual([null, 'thread-1', 'call-1', JSON.stringify(result)]);
  });

  it('looks up records by requested tool_call_id', async () => {
    const { sql, queries, values } = makeSql([
      [
        { tool_call_id: 'call-1', status: 'done', result: { ok: true, value: 'done' } },
        { tool_call_id: 'call-2', status: 'executing', result: null },
      ],
    ]);
    const store = createPostgresClientToolExecutionStore(sql);

    await expect(store.lookup('thread-1', ['call-1', 'call-2'])).resolves.toEqual({
      'call-1': { status: 'done', result: { ok: true, value: 'done' } },
      'call-2': { status: 'executing' },
    });

    expect(queries[0]).toContain('tool_call_id = ANY');
    expect(values[0]).toEqual(['thread-1', ['call-1', 'call-2']]);
  });
});
