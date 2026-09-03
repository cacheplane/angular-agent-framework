var THREADPLANE_HANDLER = 'pollThreadplaneMailbox';
var THREADPLANE_ENDPOINT_PROPERTY = 'THREADPLANE_REPLY_ENDPOINT';
var THREADPLANE_SECRET_PROPERTY = 'THREADPLANE_REPLY_HMAC_SECRET';
var THREADPLANE_INITIALIZED_PROPERTY = 'THREADPLANE_REPLY_INITIALIZED';
var THREADPLANE_CURSOR_PROPERTY = 'THREADPLANE_REPLY_HISTORY_CURSOR';
var THREADPLANE_SCAN_STATE_PROPERTY = 'THREADPLANE_REPLY_SCAN_STATE';
var THREADPLANE_RECOVERY_STATE_PROPERTY = 'THREADPLANE_REPLY_RECOVERY_STATE';
var THREADPLANE_HISTORY_PAGE_SIZE = 25;
var THREADPLANE_METADATA_HEADERS = [
  'From',
  'Message-ID',
  'X-Threadplane-Job-ID',
  'In-Reply-To',
  'References',
  'Authentication-Results',
];

function requiredThreadplaneProperty_(properties, name) {
  var value = properties.getProperty(name);
  if (!value || value.trim().length === 0) {
    throw new Error('Missing required Script Property: ' + name);
  }
  return value.trim();
}

function base64UrlNoPadding_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

function sha256Base64Url_(value) {
  return base64UrlNoPadding_(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      value,
      Utilities.Charset.UTF_8
    )
  );
}

function signThreadplaneRequest_(rawJson, secret, timestamp, nonce) {
  if (secret.length < 32) {
    throw new Error(
      'THREADPLANE_REPLY_HMAC_SECRET must be at least 32 characters'
    );
  }
  var canonical = timestamp + '\n' + nonce + '\n' + sha256Base64Url_(rawJson);
  var signature = Utilities.computeHmacSha256Signature(
    canonical,
    secret,
    Utilities.Charset.UTF_8
  );
  return 'v1=' + base64UrlNoPadding_(signature);
}

function headerMap_(message) {
  var result = {};
  var headers =
    message && message.payload && Array.isArray(message.payload.headers)
      ? message.payload.headers
      : [];
  headers.forEach(function (header) {
    if (
      header &&
      typeof header.name === 'string' &&
      typeof header.value === 'string'
    ) {
      result[header.name.toLowerCase()] = header.value.trim();
    }
  });
  return result;
}

function normalizedFromAddress_(from) {
  if (typeof from !== 'string' || from.length === 0 || from.length > 320) {
    return null;
  }
  if (/[\r\n\0]/.test(from)) return null;
  var match = /<([^<>]+)>$/.exec(from || '');
  var candidate = (match ? match[1] : from || '').trim().toLowerCase();
  if (
    candidate.length > 254 ||
    !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+$/.test(candidate) ||
    candidate.indexOf('..') !== -1
  ) {
    return null;
  }
  var pieces = candidate.split('@');
  var local = pieces[0];
  var domain = pieces[1];
  if (
    pieces.length !== 2 ||
    !local ||
    !domain ||
    local.length > 64 ||
    domain.length > 253 ||
    domain.charAt(0) === '.' ||
    domain.charAt(domain.length - 1) === '.' ||
    domain.indexOf('.') === -1
  ) {
    return null;
  }
  return candidate;
}

function normalizedRfcMessageId_(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 254 ||
    /[\r\n\0]/.test(value)
  ) {
    return null;
  }
  var raw = value.trim();
  var match =
    /^<([A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,128})@([A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?)>$/.exec(
      raw
    );
  if (!match || raw.indexOf('..') !== -1) return null;
  return '<' + match[1] + '@' + match[2].toLowerCase() + '>';
}

function normalizedJobId_(value) {
  if (typeof value !== 'string') return null;
  var candidate = value.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    candidate
  )
    ? candidate
    : null;
}

function normalizedGmailMessageId_(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
    ? value
    : null;
}

function gmailSeedVerification_(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 4096 ||
    /[\r\n\0]/.test(value)
  ) {
    return null;
  }
  var normalized = value.toLowerCase().replace(/\s+/g, ' ');
  var segments = normalized.split(';').map(function (segment) {
    return segment.trim();
  });
  if (segments.shift() !== 'mx.google.com') return null;
  var aligned = segments.some(function (segment) {
    var result = /^(dkim|dmarc)=([a-z0-9_-]+)(?:\s+|$)(.*)$/.exec(segment);
    if (!result || result[2] !== 'pass') return false;
    var properties = result[3];
    // One semicolon-delimited result is one atomic authentication assertion.
    // Reject ambiguous segments containing another method/result token.
    if (/(?:^|\s)(?:dkim|dmarc)=[a-z0-9_-]+(?:\s|$)/.test(properties)) {
      return false;
    }
    var identityName = result[1] === 'dkim' ? 'header.i' : 'header.from';
    var identities = properties.split(' ').filter(function (token) {
      return token.indexOf(identityName + '=') === 0;
    });
    if (identities.length !== 1) return false;
    if (result[1] === 'dkim') {
      return identities[0] === 'header.i=@threadplane.ai';
    }
    return identities[0] === 'header.from=threadplane.ai';
  });
  return aligned ? 'gmail_auth_aligned' : null;
}

function gmailSeedVerificationFromMessage_(message) {
  var headers =
    message && message.payload && Array.isArray(message.payload.headers)
      ? message.payload.headers
      : [];
  var googleAuthenticationResults = headers.filter(function (header) {
    return (
      header &&
      typeof header.name === 'string' &&
      header.name.toLowerCase() === 'authentication-results' &&
      typeof header.value === 'string' &&
      /^mx\.google\.com;/i.test(header.value.trim())
    );
  });
  if (googleAuthenticationResults.length !== 1) return null;
  return gmailSeedVerification_(googleAuthenticationResults[0].value.trim());
}

function referenceMessageIds_(value) {
  if (typeof value !== 'string') return [];
  var boundedValue = value.slice(Math.max(0, value.length - 8000));
  var matches = boundedValue.match(/<[^<>\s\r\n]+>/g) || [];
  var normalized = matches
    .map(normalizedRfcMessageId_)
    .filter(function (messageId) {
      return messageId !== null;
    });
  normalized = normalized.slice(Math.max(0, normalized.length - 20));
  var total = normalized.reduce(function (sum, messageId) {
    return sum + messageId.length;
  }, 0);
  while (normalized.length > 0 && total > 4000) {
    total -= normalized.shift().length;
  }
  return normalized;
}

function buildThreadplaneEvent(message) {
  if (!message) return null;
  var gmailMessageId = normalizedGmailMessageId_(message.id);
  if (!gmailMessageId) return null;
  var headers = headerMap_(message);
  var from = normalizedFromAddress_(headers['from']);
  var rfcMessageId = normalizedRfcMessageId_(headers['message-id']);
  if (!from || !rfcMessageId) return null;
  var occurredAt = new Date(Number(message.internalDate));
  if (isNaN(occurredAt.getTime())) return null;
  var jobId = normalizedJobId_(headers['x-threadplane-job-id']);
  if (from === 'brian@threadplane.ai') {
    var verification = gmailSeedVerificationFromMessage_(message);
    if (!jobId || !verification) return null;
    return {
      kind: 'seed',
      version: 1,
      gmail_message_id: gmailMessageId,
      rfc_message_id: rfcMessageId,
      occurred_at: occurredAt.toISOString(),
      from: from,
      verification: verification,
      x_threadplane_job_id: jobId,
    };
  }
  var inReplyTo = normalizedRfcMessageId_(headers['in-reply-to']);
  var references = referenceMessageIds_(headers['references']);
  if (!inReplyTo && references.length === 0) {
    return null;
  }
  var event = {
    kind: 'reply',
    version: 1,
    gmail_message_id: gmailMessageId,
    rfc_message_id: rfcMessageId,
    occurred_at: occurredAt.toISOString(),
    from: from,
  };
  if (inReplyTo) event.in_reply_to = inReplyTo;
  if (references.length > 0) event.references = references;
  return event;
}

function validHistoryId_(value) {
  return typeof value === 'string' && /^(?:0|[1-9][0-9]{0,31})$/.test(value);
}

function historyIdAtLeast_(candidate, minimum) {
  return (
    candidate.length > minimum.length ||
    (candidate.length === minimum.length && candidate >= minimum)
  );
}

function readHistoryCursor_(properties) {
  var raw = properties.getProperty(THREADPLANE_CURSOR_PROPERTY);
  if (!raw) return null;
  var parsed = JSON.parse(raw);
  if (
    !parsed ||
    parsed.version !== 1 ||
    !validHistoryId_(parsed.committedHistoryId) ||
    !validHistoryId_(parsed.overlapHistoryId) ||
    !historyIdAtLeast_(parsed.committedHistoryId, parsed.overlapHistoryId)
  ) {
    throw new Error('THREADPLANE_REPLY_HISTORY_CURSOR is invalid');
  }
  return parsed;
}

function readScanState_(properties, cursor) {
  var raw = properties.getProperty(THREADPLANE_SCAN_STATE_PROPERTY);
  if (raw) {
    var parsed = JSON.parse(raw);
    if (
      parsed &&
      parsed.version === 1 &&
      validHistoryId_(parsed.startHistoryId) &&
      (parsed.pageToken === null || validPageToken_(parsed.pageToken)) &&
      (parsed.sourceOffset === undefined ||
        validSourceOffset_(parsed.sourceOffset)) &&
      (parsed.page === undefined ||
        parsed.page === null ||
        validPageState_(parsed.page))
    ) {
      if (parsed.sourceOffset === undefined) parsed.sourceOffset = 0;
      return parsed;
    }
    throw new Error('THREADPLANE_REPLY_SCAN_STATE is invalid');
  }
  return {
    version: 1,
    startHistoryId: cursor.overlapHistoryId,
    pageToken: null,
    sourceOffset: 0,
    startedAt: new Date(Date.now()).toISOString(),
  };
}

function validPageToken_(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 512 &&
    !/[\x00-\x1f\x7f]/.test(value)
  );
}

function validSourceOffset_(value) {
  return Number.isInteger(value) && value >= 0 && value <= 1000000;
}

function validPageState_(page) {
  return Boolean(
    page &&
      Array.isArray(page.messages) &&
      page.messages.length <= THREADPLANE_HISTORY_PAGE_SIZE &&
      page.messages.every(function (item) {
        return item && normalizedGmailMessageId_(item.id);
      }) &&
      validSourceOffset_(page.sourceOffset) &&
      typeof page.sourceComplete === 'boolean' &&
      Number.isInteger(page.offset) &&
      page.offset >= 0 &&
      page.offset <= page.messages.length &&
      (page.nextPageToken === null || validPageToken_(page.nextPageToken)) &&
      (page.historyId === null || validHistoryId_(page.historyId))
  );
}

function isNotFoundError_(error) {
  return Boolean(
    error &&
      (error.code === 404 ||
        (error.details && error.details.code === 404) ||
        /(?:\b404\b|requested entity was not found|notfound)/i.test(
          String(error.message || '')
        ))
  );
}

function unavailableEvent_(gmailMessageId, occurredAt) {
  return {
    kind: 'message_unavailable',
    version: 1,
    gmail_message_id: gmailMessageId,
    occurred_at: occurredAt,
    reason: 'not_found',
  };
}

function persistState_(properties, propertyName, state) {
  properties.setProperty(propertyName, JSON.stringify(state));
}

function processStoredPage_(properties, propertyName, state, endpoint, secret) {
  var page = state.page;
  for (var index = page.offset; index < page.messages.length; index += 1) {
    var item = page.messages[index];
    try {
      var message = Gmail.Users.Messages.get('me', item.id, {
        format: 'metadata',
        metadataHeaders: THREADPLANE_METADATA_HEADERS,
      });
      var event = buildThreadplaneEvent(message);
      if (event) postThreadplaneEvent_(endpoint, secret, event);
    } catch (error) {
      if (!isNotFoundError_(error)) throw error;
      postThreadplaneEvent_(
        endpoint,
        secret,
        unavailableEvent_(item.id, state.startedAt)
      );
    }
    page.offset = index + 1;
    persistState_(properties, propertyName, state);
  }
}

function recoveryEvent_(state, kind) {
  var event = {
    kind: kind,
    version: 1,
    recovery_id: state.recoveryId,
    occurred_at: state.startedAt,
  };
  if (kind === 'recovery_required') event.reason = state.reason;
  return event;
}

function beginRecovery_(properties, endpoint, secret, reason) {
  var profile = Gmail.Users.getProfile('me');
  if (!profile || !validHistoryId_(profile.historyId)) {
    throw new Error('Gmail recovery historyId is invalid');
  }
  var state = {
    version: 1,
    recoveryId: Utilities.getUuid(),
    reason: reason,
    phase: 'pause',
    baselineHistoryId: profile.historyId,
    pageToken: null,
    sourceOffset: 0,
    page: null,
    startedAt: new Date(Date.now()).toISOString(),
  };
  persistState_(properties, THREADPLANE_RECOVERY_STATE_PROPERTY, state);
  postThreadplaneEvent_(
    endpoint,
    secret,
    recoveryEvent_(state, 'recovery_required')
  );
  state.phase = 'full_scan';
  persistState_(properties, THREADPLANE_RECOVERY_STATE_PROPERTY, state);
}

function readRecoveryState_(properties) {
  var raw = properties.getProperty(THREADPLANE_RECOVERY_STATE_PROPERTY);
  if (!raw) return null;
  var state = JSON.parse(raw);
  if (
    !state ||
    state.version !== 1 ||
    !normalizedJobId_(state.recoveryId) ||
    (state.reason !== 'cursor_missing' && state.reason !== 'history_expired') ||
    ['pause', 'full_scan', 'history_catchup'].indexOf(state.phase) === -1 ||
    !validHistoryId_(state.baselineHistoryId) ||
    (state.pageToken !== null && !validPageToken_(state.pageToken)) ||
    (state.sourceOffset !== undefined &&
      !validSourceOffset_(state.sourceOffset)) ||
    (state.page !== null && !validPageState_(state.page)) ||
    typeof state.startedAt !== 'string'
  ) {
    throw new Error('THREADPLANE_REPLY_RECOVERY_STATE is invalid');
  }
  if (state.sourceOffset === undefined) state.sourceOffset = 0;
  return state;
}

function restartRecoveryFullSync_(properties, state) {
  var profile = Gmail.Users.getProfile('me');
  if (!profile || !validHistoryId_(profile.historyId)) {
    throw new Error('Gmail recovery restart historyId is invalid');
  }
  state.phase = 'full_scan';
  state.baselineHistoryId = profile.historyId;
  state.pageToken = null;
  state.sourceOffset = 0;
  state.page = null;
  persistState_(properties, THREADPLANE_RECOVERY_STATE_PROPERTY, state);
}

function runRecovery_(properties, endpoint, secret, state) {
  if (state.phase === 'pause') {
    postThreadplaneEvent_(
      endpoint,
      secret,
      recoveryEvent_(state, 'recovery_required')
    );
    state.phase = 'full_scan';
    persistState_(properties, THREADPLANE_RECOVERY_STATE_PROPERTY, state);
    return;
  }
  if (state.phase === 'full_scan') {
    if (!state.page) {
      var listOptions = {
        maxResults: THREADPLANE_HISTORY_PAGE_SIZE,
        includeSpamTrash: true,
      };
      if (state.pageToken) listOptions.pageToken = state.pageToken;
      var fullPage = Gmail.Users.Messages.list('me', listOptions);
      var allIds = (fullPage.messages || [])
        .map(function (message) {
          return message && message.id;
        })
        .filter(normalizedGmailMessageId_)
        .map(function (id) {
          return { id: id };
        });
      if (state.sourceOffset > allIds.length) {
        throw new Error('Gmail recovery page changed during checkpoint resume');
      }
      var ids = allIds.slice(
        state.sourceOffset,
        state.sourceOffset + THREADPLANE_HISTORY_PAGE_SIZE
      );
      state.page = {
        messages: ids,
        offset: 0,
        sourceOffset: state.sourceOffset,
        sourceComplete: state.sourceOffset + ids.length >= allIds.length,
        nextPageToken:
          typeof fullPage.nextPageToken === 'string'
            ? fullPage.nextPageToken
            : null,
        historyId: null,
      };
      persistState_(properties, THREADPLANE_RECOVERY_STATE_PROPERTY, state);
    }
    processStoredPage_(
      properties,
      THREADPLANE_RECOVERY_STATE_PROPERTY,
      state,
      endpoint,
      secret
    );
    if (!state.page.sourceComplete) {
      state.sourceOffset = state.page.sourceOffset + state.page.messages.length;
      state.page = null;
    } else if (state.page.nextPageToken) {
      state.pageToken = state.page.nextPageToken;
      state.sourceOffset = 0;
      state.page = null;
    } else {
      state.phase = 'history_catchup';
      state.pageToken = null;
      state.sourceOffset = 0;
      state.page = null;
    }
    persistState_(properties, THREADPLANE_RECOVERY_STATE_PROPERTY, state);
    return;
  }

  if (!state.page) {
    var catchupOptions = {
      startHistoryId: state.baselineHistoryId,
      maxResults: THREADPLANE_HISTORY_PAGE_SIZE,
      historyTypes: ['messageAdded'],
    };
    if (state.pageToken) catchupOptions.pageToken = state.pageToken;
    var catchup;
    try {
      catchup = Gmail.Users.History.list('me', catchupOptions);
    } catch (error) {
      if (!isNotFoundError_(error)) throw error;
      restartRecoveryFullSync_(properties, state);
      return;
    }
    var catchupMessages = [];
    var seen = {};
    (catchup.history || []).forEach(function (record) {
      (record.messagesAdded || []).forEach(function (addition) {
        var id = addition && addition.message && addition.message.id;
        if (normalizedGmailMessageId_(id) && !seen[id]) {
          seen[id] = true;
          catchupMessages.push({ id: id });
        }
      });
    });
    if (state.sourceOffset > catchupMessages.length) {
      throw new Error(
        'Gmail recovery History page changed during checkpoint resume'
      );
    }
    var catchupChunk = catchupMessages.slice(
      state.sourceOffset,
      state.sourceOffset + THREADPLANE_HISTORY_PAGE_SIZE
    );
    state.page = {
      messages: catchupChunk,
      offset: 0,
      sourceOffset: state.sourceOffset,
      sourceComplete:
        state.sourceOffset + catchupChunk.length >= catchupMessages.length,
      nextPageToken:
        typeof catchup.nextPageToken === 'string'
          ? catchup.nextPageToken
          : null,
      historyId: catchup.historyId,
    };
    persistState_(properties, THREADPLANE_RECOVERY_STATE_PROPERTY, state);
  }
  processStoredPage_(
    properties,
    THREADPLANE_RECOVERY_STATE_PROPERTY,
    state,
    endpoint,
    secret
  );
  if (!state.page.sourceComplete) {
    state.sourceOffset = state.page.sourceOffset + state.page.messages.length;
    state.page = null;
    persistState_(properties, THREADPLANE_RECOVERY_STATE_PROPERTY, state);
    return;
  }
  if (state.page.nextPageToken) {
    state.pageToken = state.page.nextPageToken;
    state.sourceOffset = 0;
    state.page = null;
    persistState_(properties, THREADPLANE_RECOVERY_STATE_PROPERTY, state);
    return;
  }
  if (!validHistoryId_(state.page.historyId)) {
    throw new Error('Gmail recovery catch-up historyId is invalid');
  }
  postThreadplaneEvent_(
    endpoint,
    secret,
    recoveryEvent_(state, 'recovery_completed')
  );
  properties.setProperty(
    THREADPLANE_CURSOR_PROPERTY,
    JSON.stringify({
      version: 1,
      committedHistoryId: state.page.historyId,
      overlapHistoryId: state.baselineHistoryId,
    })
  );
  properties.deleteProperty(THREADPLANE_RECOVERY_STATE_PROPERTY);
  properties.deleteProperty(THREADPLANE_SCAN_STATE_PROPERTY);
}

function listThreadplaneHistoryPage_(scan) {
  var options = {
    startHistoryId: scan.startHistoryId,
    maxResults: THREADPLANE_HISTORY_PAGE_SIZE,
    historyTypes: ['messageAdded'],
  };
  if (scan.pageToken) options.pageToken = scan.pageToken;
  var response = Gmail.Users.History.list('me', options);
  var messages = [];
  var seen = {};
  (response.history || []).forEach(function (record, recordIndex) {
    (record.messagesAdded || []).forEach(function (addition) {
      var id = addition && addition.message && addition.message.id;
      if (normalizedGmailMessageId_(id) && !seen[id]) {
        seen[id] = true;
        messages.push({ id: id, recordIndex: recordIndex });
      }
    });
  });
  return {
    messages: messages,
    nextPageToken:
      typeof response.nextPageToken === 'string'
        ? response.nextPageToken
        : null,
    historyId: response.historyId,
  };
}

function postThreadplaneEvent_(endpoint, secret, event) {
  var rawJson = JSON.stringify(event);
  var timestamp = String(Date.now());
  var nonce = Utilities.getUuid();
  var response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    payload: rawJson,
    muteHttpExceptions: true,
    headers: {
      'X-Threadplane-Timestamp': timestamp,
      'X-Threadplane-Nonce': nonce,
      'X-Threadplane-Signature': signThreadplaneRequest_(
        rawJson,
        secret,
        timestamp,
        nonce
      ),
    },
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Threadplane endpoint did not acknowledge the event');
  }
}

function pollThreadplaneMailbox() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var properties = PropertiesService.getScriptProperties();
    var endpoint = requiredThreadplaneProperty_(
      properties,
      THREADPLANE_ENDPOINT_PROPERTY
    );
    var secret = requiredThreadplaneProperty_(
      properties,
      THREADPLANE_SECRET_PROPERTY
    );
    if (properties.getProperty(THREADPLANE_INITIALIZED_PROPERTY) !== 'v1') {
      throw new Error('Run initializeThreadplaneMailbox before polling');
    }
    var recovery = readRecoveryState_(properties);
    if (recovery) {
      runRecovery_(properties, endpoint, secret, recovery);
      return;
    }
    var cursor = readHistoryCursor_(properties);
    if (!cursor) {
      beginRecovery_(properties, endpoint, secret, 'cursor_missing');
      return;
    }
    var scan = readScanState_(properties, cursor);
    if (!scan.startedAt) {
      scan.startedAt = new Date(Date.now()).toISOString();
    }
    if (!scan.page) {
      var listed;
      try {
        listed = listThreadplaneHistoryPage_(scan);
      } catch (error) {
        if (!isNotFoundError_(error)) throw error;
        beginRecovery_(properties, endpoint, secret, 'history_expired');
        return;
      }
      if (scan.sourceOffset > listed.messages.length) {
        throw new Error('Gmail History page changed during checkpoint resume');
      }
      var listedChunk = listed.messages.slice(
        scan.sourceOffset,
        scan.sourceOffset + THREADPLANE_HISTORY_PAGE_SIZE
      );
      scan.page = {
        messages: listedChunk,
        offset: 0,
        sourceOffset: scan.sourceOffset,
        sourceComplete:
          scan.sourceOffset + listedChunk.length >= listed.messages.length,
        nextPageToken: listed.nextPageToken,
        historyId: listed.historyId,
      };
      properties.setProperty(
        THREADPLANE_SCAN_STATE_PROPERTY,
        JSON.stringify(scan)
      );
    }
    processStoredPage_(
      properties,
      THREADPLANE_SCAN_STATE_PROPERTY,
      scan,
      endpoint,
      secret
    );
    if (!scan.page.sourceComplete) {
      scan.sourceOffset = scan.page.sourceOffset + scan.page.messages.length;
      scan.page = null;
      persistState_(properties, THREADPLANE_SCAN_STATE_PROPERTY, scan);
    } else if (scan.page.nextPageToken) {
      scan.pageToken = scan.page.nextPageToken;
      scan.sourceOffset = 0;
      scan.page = null;
      persistState_(properties, THREADPLANE_SCAN_STATE_PROPERTY, scan);
    } else {
      if (!validHistoryId_(scan.page.historyId)) {
        throw new Error('Gmail history response historyId is invalid');
      }
      if (!historyIdAtLeast_(scan.page.historyId, cursor.committedHistoryId)) {
        throw new Error('Gmail history response regressed');
      }
      properties.setProperty(
        THREADPLANE_CURSOR_PROPERTY,
        JSON.stringify({
          version: 1,
          committedHistoryId: scan.page.historyId,
          overlapHistoryId: cursor.committedHistoryId,
        })
      );
      properties.deleteProperty(THREADPLANE_SCAN_STATE_PROPERTY);
    }
  } finally {
    lock.releaseLock();
  }
}

function initializeThreadplaneMailbox() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var properties = PropertiesService.getScriptProperties();
    requiredThreadplaneProperty_(properties, THREADPLANE_ENDPOINT_PROPERTY);
    requiredThreadplaneProperty_(properties, THREADPLANE_SECRET_PROPERTY);
    if (
      properties.getProperty(THREADPLANE_INITIALIZED_PROPERTY) ||
      properties.getProperty(THREADPLANE_CURSOR_PROPERTY)
    ) {
      throw new Error('Threadplane mailbox is already initialized');
    }
    var profile = Gmail.Users.getProfile('me');
    if (!profile || !validHistoryId_(profile.historyId)) {
      throw new Error('Gmail profile historyId is invalid');
    }
    properties.setProperty(THREADPLANE_INITIALIZED_PROPERTY, 'v1');
    properties.setProperty(
      THREADPLANE_CURSOR_PROPERTY,
      JSON.stringify({
        version: 1,
        committedHistoryId: profile.historyId,
        overlapHistoryId: profile.historyId,
      })
    );
  } finally {
    lock.releaseLock();
  }
}

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === THREADPLANE_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger(THREADPLANE_HANDLER)
    .timeBased()
    .everyMinutes(1)
    .create();
}
