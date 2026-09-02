import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

import {
  parseGoogleMailboxEvent,
  rankGoogleReplyCandidates,
} from '@threadplane-internal/growth';

const codePath = resolve('tools/google-mailbox-poller/Code.gs');

interface ScriptHarnessOptions {
  cursor?: string;
  noCursor?: boolean;
  messages?: Array<Record<string, unknown>>;
  nextPageTokens?: Array<string | undefined>;
  listResponses?: Array<{
    messages?: Array<{ id: string }>;
    nextPageToken?: string;
    historyId?: string;
  }>;
  postCodes?: number[];
  lockAcquired?: boolean;
  initialized?: boolean;
  getErrors?: Record<string, Error[]>;
  historyErrors?: Error[];
  fullSyncResponses?: Array<{
    messages?: Array<{ id: string }>;
    nextPageToken?: string;
  }>;
  profileHistoryIds?: string[];
}

function harness(options: ScriptHarnessOptions = {}) {
  class ScriptDate extends Date {
    static override now(): number {
      return Date.parse('2026-09-01T12:00:05.000Z');
    }
  }
  const properties = new Map<string, string>([
    [
      'THREADPLANE_REPLY_ENDPOINT',
      'https://threadplane.ai/api/growth/replies/google',
    ],
    ['THREADPLANE_REPLY_HMAC_SECRET', 's'.repeat(32)],
    ...(options.initialized !== false
      ? [['THREADPLANE_REPLY_INITIALIZED', 'v1'] as const]
      : []),
    ...(!options.noCursor
      ? [
          [
            'THREADPLANE_REPLY_HISTORY_CURSOR',
            JSON.stringify({
              version: 1,
              committedHistoryId: options.cursor ?? '1000',
              overlapHistoryId: options.cursor ?? '1000',
            }),
          ] as const,
        ]
      : []),
  ]);
  const get = vi.fn((_user: string, id: string, request: unknown) => {
    const error = options.getErrors?.[id]?.shift();
    if (error) throw error;
    return {
      id,
      internalDate: String(
        (options.messages ?? []).find((item) => item['id'] === id)?.[
          'internalDate'
        ] ?? (id === 'newer' ? '1788264002000' : '1788264001000')
      ),
      payload: {
        headers:
          (options.messages ?? []).find((item) => item['id'] === id)?.[
            'headers'
          ] ?? [],
      },
      request,
    };
  });
  const list = vi.fn(
    (
      _user: string,
      _request: {
        maxResults: number;
        pageToken?: string;
        startHistoryId: string;
        historyTypes: string[];
      }
    ) => {
      void _user;
      void _request;
      const listError = options.historyErrors?.shift();
      if (listError) throw listError;
      const configured = options.listResponses?.shift();
      const messages =
        configured?.messages ??
        (options.messages ?? []).map(({ id }) => ({ id: String(id) }));
      return {
        history: messages.map((message, index) => ({
          id: String(1_500 + index),
          messagesAdded: [{ message }],
        })),
        historyId: configured?.historyId ?? '2000',
        nextPageToken:
          configured?.nextPageToken ?? options.nextPageTokens?.shift(),
      };
    }
  );
  const messagesList = vi.fn(
    (_user: string, _request: { maxResults: number; pageToken?: string }) => {
      void _user;
      void _request;
      return options.fullSyncResponses?.shift() ?? { messages: [] };
    }
  );
  const getProfile = vi.fn(() => ({
    historyId: options.profileHistoryIds?.shift() ?? '1000',
  }));
  const fetch = vi.fn(
    (
      _url: string,
      request: { payload: string; headers: Record<string, string> }
    ) => ({
      getResponseCode: () => options.postCodes?.shift() ?? 200,
      request,
    })
  );
  const deleteTrigger = vi.fn();
  const tryLock = vi.fn(() => options.lockAcquired ?? true);
  const releaseLock = vi.fn();
  let nonceCount = 0;
  const create = vi.fn();
  const everyMinutes = vi.fn(() => ({ create }));
  const timeBased = vi.fn(() => ({ everyMinutes }));
  const newTrigger = vi.fn(() => ({ timeBased }));
  const triggers = [
    { getHandlerFunction: () => 'pollThreadplaneMailbox' },
    { getHandlerFunction: () => 'other' },
  ];
  const sandbox = {
    Date: ScriptDate,
    JSON,
    Math,
    Utilities: {
      Charset: { UTF_8: 'utf8' },
      DigestAlgorithm: { SHA_256: 'sha256' },
      MacAlgorithm: { HMAC_SHA_256: 'hmac-sha256' },
      base64EncodeWebSafe: (value: number[]) =>
        Buffer.from(value).toString('base64url'),
      computeDigest: (_algorithm: string, value: string) => [
        ...createHash('sha256').update(value).digest(),
      ],
      computeHmacSha256Signature: (value: string, key: string) => [
        ...createHmac('sha256', key).update(value).digest(),
      ],
      getUuid: () =>
        `00000000-0000-4000-8000-${String(++nonceCount).padStart(12, '0')}`,
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties.get(key) ?? null,
        setProperty: (key: string, value: string) => properties.set(key, value),
        deleteProperty: (key: string) => properties.delete(key),
      }),
    },
    LockService: {
      getScriptLock: () => ({ tryLock, releaseLock }),
    },
    Gmail: {
      Users: {
        History: { list },
        Messages: { get, list: messagesList },
        getProfile,
      },
    },
    UrlFetchApp: { fetch },
    ScriptApp: {
      getProjectTriggers: () => triggers,
      deleteTrigger,
      newTrigger,
    },
  };
  vm.runInNewContext(readFileSync(codePath, 'utf8'), sandbox);
  return {
    sandbox: sandbox as typeof sandbox & {
      pollThreadplaneMailbox: () => void;
      initializeThreadplaneMailbox: () => void;
      setupTrigger: () => void;
      buildThreadplaneEvent: (message: unknown) => unknown;
    },
    properties,
    get,
    getProfile,
    list,
    messagesList,
    fetch,
    deleteTrigger,
    create,
    everyMinutes,
    tryLock,
    releaseLock,
  };
}

function historyCursor(properties: Map<string, string>): {
  committedHistoryId: string;
  overlapHistoryId: string;
} {
  return JSON.parse(String(properties.get('THREADPLANE_REPLY_HISTORY_CURSOR')));
}

const seedHeaders = [
  { name: 'From', value: 'Brian at Threadplane <brian@threadplane.ai>' },
  { name: 'Message-ID', value: '<seed@threadplane.ai>' },
  {
    name: 'X-Threadplane-Job-ID',
    value: '00000000-0000-4000-8000-000000000001',
  },
  {
    name: 'Authentication-Results',
    value:
      'mx.google.com; dkim=pass header.i=@threadplane.ai; dmarc=pass header.from=threadplane.ai',
  },
];
const replyHeaders = [
  { name: 'from', value: 'Developer <developer@example.com>' },
  { name: 'message-id', value: '<reply@example.com>' },
  { name: 'in-reply-to', value: '<seed@threadplane.ai>' },
  { name: 'references', value: '<older@example.com> <seed@threadplane.ai>' },
];

describe('Google mailbox poller', () => {
  it('requires explicit first-install initialization and never silently replaces a missing production cursor', () => {
    const firstInstall = harness({ noCursor: true, initialized: false });
    expect(() => firstInstall.sandbox.pollThreadplaneMailbox()).toThrow(
      /initialize/iu
    );
    expect(firstInstall.getProfile).not.toHaveBeenCalled();

    firstInstall.sandbox.initializeThreadplaneMailbox();
    expect(firstInstall.getProfile).toHaveBeenCalledWith('me');
    expect(firstInstall.properties.get('THREADPLANE_REPLY_INITIALIZED')).toBe(
      'v1'
    );
    expect(historyCursor(firstInstall.properties)).toMatchObject({
      committedHistoryId: '1000',
      overlapHistoryId: '1000',
    });

    const lostCursor = harness({ noCursor: true });
    lostCursor.sandbox.pollThreadplaneMailbox();
    expect(lostCursor.getProfile).toHaveBeenCalledWith('me');
    expect(lostCursor.properties.has('THREADPLANE_REPLY_HISTORY_CURSOR')).toBe(
      false
    );
    expect(
      lostCursor.properties.get('THREADPLANE_REPLY_RECOVERY_STATE')
    ).toBeTruthy();
    expect(
      JSON.parse(lostCursor.fetch.mock.calls[0]?.[1].payload)
    ).toMatchObject({
      kind: 'recovery_required',
      reason: 'cursor_missing',
    });
  });

  it('round-trips bounded opaque Gmail page tokens without changing punctuation', () => {
    const test = harness({ messages: [] });
    test.properties.set(
      'THREADPLANE_REPLY_SCAN_STATE',
      JSON.stringify({
        version: 1,
        startHistoryId: '1000',
        pageToken: 'opaque+/=.token',
      })
    );
    test.sandbox.pollThreadplaneMailbox();
    expect(test.list.mock.calls[0]?.[1].pageToken).toBe('opaque+/=.token');
  });

  it('records a vanished message as terminally unavailable and continues to a valid reply', () => {
    const notFound = Object.assign(
      new Error('Requested entity was not found'),
      {
        code: 404,
      }
    );
    const test = harness({
      messages: [
        { id: 'vanished', headers: replyHeaders },
        { id: 'valid-after-vanish', headers: replyHeaders },
      ],
      getErrors: { vanished: [notFound] },
    });
    test.sandbox.pollThreadplaneMailbox();
    const posted = test.fetch.mock.calls.map((call) =>
      JSON.parse(call[1].payload)
    );
    expect(posted).toEqual([
      expect.objectContaining({
        kind: 'message_unavailable',
        gmail_message_id: 'vanished',
        reason: 'not_found',
      }),
      expect.objectContaining({
        kind: 'reply',
        gmail_message_id: 'valid-after-vanish',
      }),
    ]);
    expect(historyCursor(test.properties).committedHistoryId).toBe('2000');
  });

  it('pauses on an expired History watermark, resumes a metadata-only full scan, catches up History, then unpauses', () => {
    const history404 = Object.assign(
      new Error('404 Requested entity was not found'),
      {
        code: 404,
      }
    );
    const test = harness({
      messages: [
        { id: 'recovery-seed', headers: seedHeaders },
        { id: 'recovery-reply', headers: replyHeaders },
      ],
      historyErrors: [history404],
      fullSyncResponses: [
        { messages: [{ id: 'recovery-reply' }, { id: 'recovery-seed' }] },
      ],
      listResponses: [{ messages: [], historyId: '2000' }],
    });

    test.sandbox.pollThreadplaneMailbox();
    expect(JSON.parse(test.fetch.mock.calls[0]?.[1].payload)).toMatchObject({
      kind: 'recovery_required',
      reason: 'history_expired',
    });
    expect(historyCursor(test.properties).committedHistoryId).toBe('1000');

    test.sandbox.pollThreadplaneMailbox();
    expect(test.messagesList).toHaveBeenCalledWith('me', {
      maxResults: 25,
      includeSpamTrash: true,
    });
    expect(
      test.fetch.mock.calls
        .slice(1)
        .map((call) => JSON.parse(call[1].payload).kind)
    ).toEqual(['reply', 'seed']);

    test.sandbox.pollThreadplaneMailbox();
    expect(test.list.mock.calls.at(-1)?.[1]).toMatchObject({
      startHistoryId: '1000',
    });
    expect(
      JSON.parse(String(test.fetch.mock.calls.at(-1)?.[1].payload))
    ).toMatchObject({
      kind: 'recovery_completed',
    });
    expect(test.properties.has('THREADPLANE_REPLY_RECOVERY_STATE')).toBe(false);
    expect(historyCursor(test.properties).committedHistoryId).toBe('2000');
  });

  it('restarts the metadata-only full sync under the same pause when recovery catch-up history expires', () => {
    const history404 = () =>
      Object.assign(new Error('404 Requested entity was not found'), {
        code: 404,
      });
    const test = harness({
      messages: [
        { id: 'reply-before-restart', headers: replyHeaders },
        { id: 'reply-after-restart', headers: replyHeaders },
      ],
      historyErrors: [history404(), history404()],
      profileHistoryIds: ['1000', '1500'],
      fullSyncResponses: [
        { messages: [{ id: 'reply-before-restart' }] },
        { messages: [{ id: 'reply-after-restart' }] },
      ],
      listResponses: [{ messages: [], historyId: '2000' }],
    });

    test.sandbox.pollThreadplaneMailbox();
    const recoveryId = JSON.parse(
      String(test.properties.get('THREADPLANE_REPLY_RECOVERY_STATE'))
    ).recoveryId;
    test.sandbox.pollThreadplaneMailbox();

    expect(() => test.sandbox.pollThreadplaneMailbox()).not.toThrow();
    const restarted = JSON.parse(
      String(test.properties.get('THREADPLANE_REPLY_RECOVERY_STATE'))
    );
    expect(restarted).toMatchObject({
      recoveryId,
      phase: 'full_scan',
      baselineHistoryId: '1500',
      pageToken: null,
      sourceOffset: 0,
      page: null,
    });
    expect(
      test.fetch.mock.calls.map((call) => JSON.parse(call[1].payload).kind)
    ).not.toContain('recovery_completed');

    test.sandbox.pollThreadplaneMailbox();
    test.sandbox.pollThreadplaneMailbox();
    const postedReplies = test.fetch.mock.calls
      .map((call) => JSON.parse(call[1].payload))
      .filter((event) => event.kind === 'reply')
      .map((event) => event.gmail_message_id);
    expect(postedReplies).toEqual([
      'reply-before-restart',
      'reply-after-restart',
    ]);
    expect(
      JSON.parse(String(test.fetch.mock.calls.at(-1)?.[1].payload))
    ).toMatchObject({ kind: 'recovery_completed', recovery_id: recoveryId });
    expect(historyCursor(test.properties)).toMatchObject({
      committedHistoryId: '2000',
      overlapHistoryId: '1500',
    });
  });

  it('checkpoints each acknowledged message and resumes mid-page without skipping later messages', () => {
    const test = harness({
      messages: [
        { id: 'offset-1', headers: replyHeaders },
        { id: 'offset-2', headers: replyHeaders },
        { id: 'offset-3', headers: replyHeaders },
      ],
      postCodes: [200, 500, 200, 200],
    });
    expect(() => test.sandbox.pollThreadplaneMailbox()).toThrow();
    const state = JSON.parse(
      String(test.properties.get('THREADPLANE_REPLY_SCAN_STATE'))
    );
    expect(state.page.offset).toBe(1);

    test.sandbox.pollThreadplaneMailbox();
    expect(
      test.fetch.mock.calls.map(
        (call) => JSON.parse(call[1].payload).gmail_message_id
      )
    ).toEqual(['offset-1', 'offset-2', 'offset-2', 'offset-3']);
    expect(historyCursor(test.properties).committedHistoryId).toBe('2000');
  });

  it('still bootstraps no mailbox data during the explicit initializer', () => {
    const test = harness({ noCursor: true, initialized: false });
    test.sandbox.initializeThreadplaneMailbox();
    expect(test.getProfile).toHaveBeenCalledWith('me');
    expect(test.list).not.toHaveBeenCalled();
    expect(test.get).not.toHaveBeenCalled();
    expect(test.fetch).not.toHaveBeenCalled();
    expect(historyCursor(test.properties)).toMatchObject({
      committedHistoryId: '1000',
      overlapHistoryId: '1000',
    });
    expect(test.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('requests only exact metadata headers and processes oldest first', () => {
    const test = harness({
      messages: [
        { id: 'newer', headers: replyHeaders },
        { id: 'older', headers: seedHeaders },
      ],
      listResponses: [
        { messages: [{ id: 'older' }, { id: 'newer' }], historyId: '2000' },
      ],
    });
    test.sandbox.pollThreadplaneMailbox();
    expect(test.get).toHaveBeenCalledTimes(2);
    for (const call of test.get.mock.calls) {
      expect(call[2]).toEqual({
        format: 'metadata',
        metadataHeaders: [
          'From',
          'Message-ID',
          'X-Threadplane-Job-ID',
          'In-Reply-To',
          'References',
          'Authentication-Results',
        ],
      });
    }
    const payloads = test.fetch.mock.calls.map((call) =>
      JSON.parse(call[1].payload)
    );
    expect(payloads.map((event) => event.gmail_message_id)).toEqual([
      'older',
      'newer',
    ]);
  });

  it('uses bounded chronological Gmail History pages with one-interval overlap and advances only after every acknowledgement', () => {
    const startCursor = '1000';
    const success = harness({
      cursor: startCursor,
      messages: [{ id: 'older', headers: seedHeaders }],
    });
    success.sandbox.pollThreadplaneMailbox();
    const listRequest = success.list.mock.calls[0]?.[1];
    expect(listRequest).toEqual({
      startHistoryId: startCursor,
      maxResults: 25,
      historyTypes: ['messageAdded'],
    });
    expect(historyCursor(success.properties)).toEqual({
      version: 1,
      committedHistoryId: '2000',
      overlapHistoryId: startCursor,
    });

    const failed = harness({
      cursor: startCursor,
      messages: [{ id: 'older', headers: seedHeaders }],
      postCodes: [500],
    });
    expect(() => failed.sandbox.pollThreadplaneMailbox()).toThrow();
    expect(historyCursor(failed.properties).committedHistoryId).toBe(
      startCursor
    );
  });

  it('drains globally chronological Gmail History pages before advancing the overlap cursor', () => {
    const startCursor = '1000';
    const test = harness({
      cursor: startCursor,
      messages: [
        {
          id: 'older-seed',
          internalDate: String(Date.parse('2026-09-01T11:50:00.000Z')),
          headers: seedHeaders,
        },
        {
          id: 'newer-reply',
          internalDate: String(Date.parse('2026-09-01T11:59:00.000Z')),
          headers: replyHeaders,
        },
      ],
      listResponses: [
        {
          messages: [{ id: 'older-seed' }],
          nextPageToken: 'history-page-2',
          historyId: '2000',
        },
        { messages: [{ id: 'newer-reply' }], historyId: '3000' },
      ],
    });

    test.sandbox.pollThreadplaneMailbox();
    expect(
      JSON.parse(test.fetch.mock.calls[0]?.[1].payload).gmail_message_id
    ).toBe('older-seed');
    expect(historyCursor(test.properties).committedHistoryId).toBe(startCursor);
    expect(test.properties.get('THREADPLANE_REPLY_SCAN_STATE')).toContain(
      'history-page-2'
    );

    test.sandbox.pollThreadplaneMailbox();
    expect(
      test.fetch.mock.calls.map(
        (call) => JSON.parse(call[1].payload).gmail_message_id
      )
    ).toEqual(['older-seed', 'newer-reply']);
    expect(historyCursor(test.properties)).toMatchObject({
      committedHistoryId: '3000',
      overlapHistoryId: startCursor,
    });
  });

  it('eventually drains more than one full History page even when every message has the same timestamp', () => {
    const startCursor = '1000';
    const messages = Array.from({ length: 26 }, (_, index) => ({
      id: `same-second-${String(index).padStart(3, '0')}`,
      internalDate: '1788264000000',
      headers: index === 0 ? seedHeaders : replyHeaders,
    }));
    const test = harness({
      cursor: startCursor,
      messages,
      listResponses: [
        {
          messages: messages.slice(0, 25).map(({ id }) => ({ id })),
          nextPageToken: 'history-page-2',
          historyId: '2000',
        },
        {
          messages: messages.slice(25).map(({ id }) => ({ id })),
          historyId: '3000',
        },
      ],
    });

    test.sandbox.pollThreadplaneMailbox();
    expect(test.fetch).toHaveBeenCalledTimes(25);
    expect(historyCursor(test.properties).committedHistoryId).toBe(startCursor);

    test.sandbox.pollThreadplaneMailbox();
    expect(test.fetch).toHaveBeenCalledTimes(26);
    expect(
      JSON.parse(test.fetch.mock.calls[0]?.[1].payload).gmail_message_id
    ).toBe('same-second-000');
    expect(
      JSON.parse(test.fetch.mock.calls[25]?.[1].payload).gmail_message_id
    ).toBe('same-second-025');
    expect(historyCursor(test.properties)).toMatchObject({
      committedHistoryId: '3000',
      overlapHistoryId: startCursor,
    });
  });

  it('checkpoints bounded chunks when one History API page contains more message additions than the run budget', () => {
    const startCursor = '1000';
    const messages = Array.from({ length: 30 }, (_, index) => ({
      id: `dense-page-${String(index).padStart(3, '0')}`,
      internalDate: '1788264000000',
      headers: replyHeaders,
    }));
    const densePage = {
      messages: messages.map(({ id }) => ({ id })),
      historyId: '3000',
    };
    const test = harness({
      cursor: startCursor,
      messages,
      // The same opaque Gmail page is fetched again from its durable source
      // offset; only the bounded unacknowledged suffix is processed.
      listResponses: [densePage, densePage],
    });

    test.sandbox.pollThreadplaneMailbox();
    expect(test.fetch).toHaveBeenCalledTimes(25);
    expect(historyCursor(test.properties).committedHistoryId).toBe(startCursor);

    test.sandbox.pollThreadplaneMailbox();
    expect(test.fetch).toHaveBeenCalledTimes(30);
    expect(
      test.fetch.mock.calls.map(
        (call) => JSON.parse(call[1].payload).gmail_message_id
      )
    ).toEqual(messages.map(({ id }) => id));
    expect(historyCursor(test.properties)).toMatchObject({
      committedHistoryId: '3000',
      overlapHistoryId: startCursor,
    });
  });

  it('rejects a regressing Gmail History high-water mark without changing the cursor', () => {
    const test = harness({
      cursor: '2000',
      listResponses: [{ messages: [], historyId: '1999' }],
    });
    expect(() => test.sandbox.pollThreadplaneMailbox()).toThrow(/regressed/u);
    expect(historyCursor(test.properties)).toMatchObject({
      committedHistoryId: '2000',
      overlapHistoryId: '2000',
    });
    expect(test.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('exits without reads or writes when another poller owns the ScriptLock and always releases acquired locks', () => {
    const overlapping = harness({ lockAcquired: false });
    overlapping.sandbox.pollThreadplaneMailbox();
    expect(overlapping.list).not.toHaveBeenCalled();
    expect(overlapping.fetch).not.toHaveBeenCalled();
    expect(overlapping.releaseLock).not.toHaveBeenCalled();

    const failed = harness({
      messages: [{ id: 'reply', headers: replyHeaders }],
      postCodes: [500],
    });
    expect(() => failed.sandbox.pollThreadplaneMailbox()).toThrow();
    expect(failed.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('replays a failed page with a fresh nonce and keeps the cursor monotonic', () => {
    const startCursor = '1000';
    const test = harness({
      cursor: startCursor,
      messages: [
        {
          id: 'retry',
          internalDate: String(Date.parse('2026-09-01T11:50:00.000Z')),
          headers: replyHeaders,
        },
      ],
      listResponses: [
        {
          messages: [],
          nextPageToken: 'retry-history-page',
          historyId: '2000',
        },
        { messages: [{ id: 'retry' }], historyId: '3000' },
        { messages: [{ id: 'retry' }], historyId: '3000' },
      ],
      postCodes: [500, 200],
    });
    test.sandbox.pollThreadplaneMailbox();
    expect(test.fetch).not.toHaveBeenCalled();
    expect(() => test.sandbox.pollThreadplaneMailbox()).toThrow();
    expect(historyCursor(test.properties).committedHistoryId).toBe(startCursor);
    const failedState = test.properties.get('THREADPLANE_REPLY_SCAN_STATE');
    const firstNonce =
      test.fetch.mock.calls[0]?.[1].headers['X-Threadplane-Nonce'];

    test.sandbox.pollThreadplaneMailbox();
    const secondNonce =
      test.fetch.mock.calls[1]?.[1].headers['X-Threadplane-Nonce'];
    expect(secondNonce).not.toBe(firstNonce);
    expect(test.properties.get('THREADPLANE_REPLY_SCAN_STATE')).toBeUndefined();
    expect(historyCursor(test.properties)).toMatchObject({
      committedHistoryId: '3000',
      overlapHistoryId: startCursor,
    });
    expect(failedState).toContain('retry-history-page');
    expect(test.releaseLock).toHaveBeenCalledTimes(3);
  });

  it('ignores unrelated mail and never requests or emits body, snippet, subject, or attachments', () => {
    const test = harness({
      messages: [
        {
          id: 'older',
          headers: [
            { name: 'From', value: 'newsletter@example.com' },
            { name: 'Subject', value: 'secret' },
          ],
        },
      ],
    });
    test.sandbox.pollThreadplaneMailbox();
    expect(test.fetch).not.toHaveBeenCalled();
    const source = readFileSync(codePath, 'utf8');
    expect(source).not.toMatch(
      /getPlainBody|getBody|getAttachments|\.snippet|\['Subject'\]|"Subject"/u
    );
  });

  it('classifies Brian+job as seed and non-Brian references as reply', () => {
    const test = harness();
    const seedEvent = test.sandbox.buildThreadplaneEvent({
      id: 'seed',
      internalDate: '1788264000000',
      payload: { headers: seedHeaders },
    });
    const replyEvent = test.sandbox.buildThreadplaneEvent({
      id: 'reply',
      internalDate: '1788264000000',
      payload: { headers: replyHeaders },
    });
    expect(seedEvent).toMatchObject({
      kind: 'seed',
      from: 'brian@threadplane.ai',
    });
    expect(replyEvent).toMatchObject({
      kind: 'reply',
      from: 'developer@example.com',
    });
    expect(() =>
      parseGoogleMailboxEvent(JSON.stringify(seedEvent))
    ).not.toThrow();
    expect(() =>
      parseGoogleMailboxEvent(JSON.stringify(replyEvent))
    ).not.toThrow();
  });

  it('requires aligned Gmail authentication for Brian seeds and transmits only the closed verification value', () => {
    const test = harness();
    for (const authenticationResults of [
      undefined,
      'mx.google.com; dkim=fail header.i=@threadplane.ai; dmarc=fail header.from=threadplane.ai',
      'mx.google.com; dkim=pass header.i=@attacker.example; dmarc=pass header.from=attacker.example',
    ]) {
      const headers = seedHeaders.filter(
        (header) => header.name !== 'Authentication-Results'
      );
      if (authenticationResults) {
        headers.push({
          name: 'Authentication-Results',
          value: authenticationResults,
        });
      }
      expect(
        test.sandbox.buildThreadplaneEvent({
          id: 'forged-seed',
          internalDate: '1788264000000',
          payload: { headers },
        })
      ).toBeNull();
    }
    expect(
      test.sandbox.buildThreadplaneEvent({
        id: 'ambiguous-seed',
        internalDate: '1788264000000',
        payload: {
          headers: [
            ...seedHeaders,
            {
              name: 'Authentication-Results',
              value:
                'mx.google.com; dkim=fail header.i=@threadplane.ai; dmarc=fail header.from=threadplane.ai',
            },
          ],
        },
      })
    ).toBeNull();

    const event = test.sandbox.buildThreadplaneEvent({
      id: 'verified-seed',
      internalDate: '1788264000000',
      payload: { headers: seedHeaders },
    }) as Record<string, unknown>;
    expect(event['verification']).toBe('gmail_auth_aligned');
    expect(JSON.stringify(event)).not.toContain('Authentication-Results');
    expect(Object.keys(event)).not.toContain('authentication_results');
  });

  it.each([
    [
      'DKIM',
      'mx.google.com; dkim=pass header.i=@attacker.example; dkim=fail header.i=@threadplane.ai',
    ],
    [
      'DMARC',
      'mx.google.com; dmarc=pass header.from=attacker.example; dmarc=fail header.from=threadplane.ai',
    ],
  ])('does not combine mixed %s result segments', (_method, value) => {
    const test = harness();
    const headers = seedHeaders.map((header) =>
      header.name === 'Authentication-Results' ? { ...header, value } : header
    );
    expect(
      test.sandbox.buildThreadplaneEvent({
        id: 'mixed-auth-seed',
        internalDate: '1788264000000',
        payload: { headers },
      })
    ).toBeNull();
  });

  it('emits the exact maximum reply payload accepted by the real server parser and ranker', () => {
    const test = harness();
    const references = Array.from(
      { length: 20 },
      (_, index) => `<ref-${index}@example.com>`
    ).join(' ');
    const emitted = test.sandbox.buildThreadplaneEvent({
      id: 'maximum-reply',
      internalDate: '1788264000000',
      payload: {
        headers: [
          { name: 'From', value: 'developer@example.com' },
          { name: 'Message-ID', value: '<reply-max@example.com>' },
          { name: 'In-Reply-To', value: '<direct@example.com>' },
          { name: 'References', value: references },
        ],
      },
    });
    const parsed = parseGoogleMailboxEvent(JSON.stringify(emitted));
    expect(parsed.kind).toBe('reply');
    if (parsed.kind !== 'reply') throw new Error('expected reply');
    const ranked = rankGoogleReplyCandidates(parsed);
    expect(ranked).toHaveLength(21);
    expect(ranked.at(-1)?.rank).toBe(20);
  });

  it('normalizes and bounds RFC references to the newest server-valid values', () => {
    const test = harness();
    const references = Array.from(
      { length: 25 },
      (_, index) => `<ref-${index}@Example.COM>`
    ).join(' ');
    const event = test.sandbox.buildThreadplaneEvent({
      id: 'valid_gmail_id',
      internalDate: '1788264000000',
      payload: {
        headers: [
          { name: 'From', value: 'Developer <DEVELOPER@EXAMPLE.COM>' },
          { name: 'Message-ID', value: '<Reply.Local@Example.COM>' },
          { name: 'In-Reply-To', value: 'not-a-message-id' },
          { name: 'References', value: references },
        ],
      },
    }) as {
      from: string;
      in_reply_to?: string;
      references: string[];
      rfc_message_id: string;
    };

    expect(event.from).toBe('developer@example.com');
    expect(event.rfc_message_id).toBe('<Reply.Local@example.com>');
    expect(event.in_reply_to).toBeUndefined();
    expect(event.references).toHaveLength(20);
    expect(event.references[0]).toBe('<ref-5@example.com>');
    expect(event.references.at(-1)).toBe('<ref-24@example.com>');
    expect(event.references.join('').length).toBeLessThanOrEqual(4_000);

    const longEvent = test.sandbox.buildThreadplaneEvent({
      id: 'valid_long_refs',
      internalDate: '1788264000000',
      payload: {
        headers: [
          { name: 'From', value: 'developer@example.com' },
          { name: 'Message-ID', value: '<reply-long@example.com>' },
          {
            name: 'References',
            value: `<old@example.com> ${'x'.repeat(
              9_000
            )} <latest@example.com>`,
          },
        ],
      },
    }) as { references: string[] };
    expect(longEvent.references).toEqual(['<latest@example.com>']);
  });

  it('ignores malformed or overlong metadata, posts the later valid event, and advances the cursor', () => {
    const startCursor = '1000';
    const test = harness({
      cursor: startCursor,
      messages: [
        {
          id: 'invalid gmail id',
          internalDate: '1788264000000',
          headers: replyHeaders,
        },
        {
          id: 'bad-from',
          internalDate: '1788264000001',
          headers: [
            { name: 'From', value: `${'x'.repeat(300)}@example.com` },
            { name: 'Message-ID', value: '<reply@example.com>' },
            { name: 'In-Reply-To', value: '<seed@threadplane.ai>' },
          ],
        },
        {
          id: 'bad-rfc',
          internalDate: '1788264000002',
          headers: [
            { name: 'From', value: 'developer@example.com' },
            { name: 'Message-ID', value: 'not-an-rfc-id' },
            { name: 'In-Reply-To', value: '<seed@threadplane.ai>' },
          ],
        },
        {
          id: 'bad-job',
          internalDate: '1788264000003',
          headers: seedHeaders.map((header) =>
            header.name === 'X-Threadplane-Job-ID'
              ? { ...header, value: 'not-a-uuid' }
              : header
          ),
        },
        {
          id: 'valid-later',
          internalDate: '1788264000004',
          headers: replyHeaders,
        },
      ],
    });

    test.sandbox.pollThreadplaneMailbox();

    expect(test.fetch).toHaveBeenCalledTimes(1);
    const posted = JSON.parse(test.fetch.mock.calls[0]?.[1].payload);
    expect(posted).toMatchObject({
      gmail_message_id: 'valid-later',
      from: 'developer@example.com',
    });
    expect(() => parseGoogleMailboxEvent(JSON.stringify(posted))).not.toThrow();
    expect(historyCursor(test.properties)).toMatchObject({
      committedHistoryId: '2000',
      overlapHistoryId: startCursor,
    });
  });

  it('advances after an acknowledged terminal seed rejection and a later valid reply', () => {
    const startCursor = '1000';
    const test = harness({
      cursor: startCursor,
      messages: [
        {
          id: 'terminally-rejected-seed',
          internalDate: '1788264000000',
          headers: seedHeaders,
        },
        {
          id: 'later-valid-event',
          internalDate: '1788264000001',
          headers: replyHeaders,
        },
      ],
      postCodes: [200, 200],
    });

    test.sandbox.pollThreadplaneMailbox();

    expect(test.fetch).toHaveBeenCalledTimes(2);
    expect(historyCursor(test.properties)).toMatchObject({
      committedHistoryId: '2000',
      overlapHistoryId: startCursor,
    });
  });

  it('advances after an acknowledged invalid recipient binding and then posts a later valid reply', () => {
    const startCursor = '1000';
    const test = harness({
      cursor: startCursor,
      messages: [
        {
          id: 'invalid-matched-binding',
          internalDate: '1788264000000',
          headers: replyHeaders,
        },
        {
          id: 'later-valid-reply',
          internalDate: '1788264000001',
          headers: replyHeaders,
        },
      ],
      postCodes: [200, 200],
    });
    test.sandbox.pollThreadplaneMailbox();
    expect(
      test.fetch.mock.calls.map(
        (call) => JSON.parse(call[1].payload).gmail_message_id
      )
    ).toEqual(['invalid-matched-binding', 'later-valid-reply']);
    expect(historyCursor(test.properties)).toMatchObject({
      committedHistoryId: '2000',
      overlapHistoryId: startCursor,
    });
  });

  it('signs the exact posted JSON bytes with a unique nonce', () => {
    const test = harness({
      messages: [{ id: 'older', headers: replyHeaders }],
    });
    test.sandbox.pollThreadplaneMailbox();
    const request = test.fetch.mock.calls[0]?.[1];
    const digest = createHash('sha256')
      .update(request.payload)
      .digest('base64url');
    const canonical = `${request.headers['X-Threadplane-Timestamp']}\n${request.headers['X-Threadplane-Nonce']}\n${digest}`;
    expect(request.headers['X-Threadplane-Signature']).toBe(
      `v1=${createHmac('sha256', 's'.repeat(32))
        .update(canonical)
        .digest('base64url')}`
    );
  });

  it('removes duplicate poller triggers and installs exactly one every-minute trigger', () => {
    const test = harness();
    test.sandbox.setupTrigger();
    expect(test.deleteTrigger).toHaveBeenCalledTimes(1);
    expect(test.everyMinutes).toHaveBeenCalledWith(1);
    expect(test.create).toHaveBeenCalledTimes(1);
  });
});
