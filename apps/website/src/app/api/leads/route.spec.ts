import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmailMock = vi.hoisted(() => vi.fn());
const addToAudienceMock = vi.hoisted(() => vi.fn());
const loopsUpsertContactMock = vi.hoisted(() => vi.fn());
const loopsSendEventMock = vi.hoisted(() => vi.fn());
const scheduleWhitepaperDripMock = vi.hoisted(() => vi.fn());
const captureLeadConversionMock = vi.hoisted(() => vi.fn());
const captureLeadQualifiedMock = vi.hoisted(() => vi.fn());
const captureNewsletterConversionMock = vi.hoisted(() => vi.fn());
const captureWhitepaperConversionMock = vi.hoisted(() => vi.fn());
const mkdirSyncMock = vi.hoisted(() => vi.fn());
const appendFileSyncMock = vi.hoisted(() => vi.fn());

vi.mock('fs', () => ({
  default: {
    mkdirSync: mkdirSyncMock,
    appendFileSync: appendFileSyncMock,
  },
}));

vi.mock('../../../../lib/resend', () => ({
  FROM: 'Threadplane <hello@cacheplane.ai>',
  NOTIFY_TO: 'hello@cacheplane.ai',
  sendEmail: sendEmailMock,
  addToAudience: addToAudienceMock,
}));

vi.mock('../../../../lib/loops', () => ({
  loopsUpsertContact: loopsUpsertContactMock,
  loopsSendEvent: loopsSendEventMock,
}));

vi.mock('../../../../lib/drip', () => ({
  scheduleWhitepaperDrip: scheduleWhitepaperDripMock,
}));

vi.mock('../../../lib/analytics/server', () => ({
  captureLeadConversion: captureLeadConversionMock,
  captureLeadQualified: captureLeadQualifiedMock,
  captureNewsletterConversion: captureNewsletterConversionMock,
  captureWhitepaperConversion: captureWhitepaperConversionMock,
}));

import { POST as postLead } from './route';
import { POST as postNewsletter } from '../newsletter/route';
import { POST as postWhitepaperSignup } from '../whitepaper-signup/route';

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`https://threadplane.ai${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      referer: 'https://threadplane.ai/pricing',
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sendEmailMock.mockResolvedValue(undefined);
  addToAudienceMock.mockResolvedValue(undefined);
  loopsUpsertContactMock.mockResolvedValue(undefined);
  loopsSendEventMock.mockResolvedValue(undefined);
  scheduleWhitepaperDripMock.mockResolvedValue(undefined);
  captureLeadConversionMock.mockResolvedValue(undefined);
  captureLeadQualifiedMock.mockResolvedValue(undefined);
  captureNewsletterConversionMock.mockResolvedValue(undefined);
  captureWhitepaperConversionMock.mockResolvedValue(undefined);
});

describe('/api/leads', () => {
  it('persists the lead, notifies the team, syncs audience systems, and records analytics', async () => {
    const response = await postLead(jsonRequest('/api/leads', {
      name: 'Jane Smith',
      email: 'jane@acme.com',
      company: 'Acme',
      message: 'We are evaluating Threadplane.',
    }) as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(appendFileSyncMock).toHaveBeenCalledWith(
      expect.stringContaining('data/leads.ndjson'),
      expect.stringContaining('"email":"jane@acme.com"'),
      'utf8',
    );
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Threadplane <hello@cacheplane.ai>',
      to: 'hello@cacheplane.ai',
      subject: 'New lead: Jane Smith at Acme',
      html: expect.stringContaining('jane@acme.com'),
    }));
    expect(addToAudienceMock).toHaveBeenCalledWith('jane@acme.com', 'Jane Smith');
    expect(loopsUpsertContactMock).toHaveBeenCalledWith(expect.objectContaining({
      email: 'jane@acme.com',
      firstName: 'Jane Smith',
      source: 'lead-form',
      properties: { company: 'Acme' },
    }));
    expect(loopsSendEventMock).toHaveBeenCalledWith(expect.objectContaining({
      email: 'jane@acme.com',
      eventName: 'lead_submitted',
    }));
    expect(captureLeadConversionMock).toHaveBeenCalledWith(expect.objectContaining({
      email: 'jane@acme.com',
      company: 'Acme',
      sourcePage: '/pricing',
    }));
    expect(captureLeadQualifiedMock).toHaveBeenCalledWith(expect.objectContaining({
      email: 'jane@acme.com',
      company: 'Acme',
      sourcePage: '/pricing',
    }));
  });

  it('rejects malformed lead emails before sending or persisting anything', async () => {
    const response = await postLead(jsonRequest('/api/leads', { email: 'not-an-email' }) as never);

    expect(response.status).toBe(400);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(addToAudienceMock).not.toHaveBeenCalled();
    expect(appendFileSyncMock).not.toHaveBeenCalled();
  });
});

describe('/api/newsletter', () => {
  it('sends the welcome email, adds the contact to Resend, and records analytics', async () => {
    const response = await postNewsletter(jsonRequest('/api/newsletter', { email: 'reader@acme.com' }) as never);

    expect(response.status).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Threadplane <hello@cacheplane.ai>',
      to: 'reader@acme.com',
      subject: 'Welcome to Threadplane updates',
    }));
    expect(addToAudienceMock).toHaveBeenCalledWith('reader@acme.com');
    expect(loopsUpsertContactMock).toHaveBeenCalledWith(expect.objectContaining({
      email: 'reader@acme.com',
      source: 'newsletter',
    }));
    expect(loopsSendEventMock).toHaveBeenCalledWith(expect.objectContaining({
      email: 'reader@acme.com',
      eventName: 'newsletter_subscribed',
    }));
    expect(captureNewsletterConversionMock).toHaveBeenCalledWith({
      email: 'reader@acme.com',
      sourcePage: '/pricing',
    });
  });
});

describe('/api/whitepaper-signup', () => {
  it('sends the requested download, schedules drip, syncs the audience, and records analytics', async () => {
    const response = await postWhitepaperSignup(jsonRequest('/api/whitepaper-signup', {
      name: 'Reader',
      email: 'reader@acme.com',
      paper: 'chat',
    }) as never);

    expect(response.status).toBe(200);
    expect(appendFileSyncMock).toHaveBeenCalledWith(
      expect.stringContaining('data/whitepaper-signups.ndjson'),
      expect.stringContaining('"paper":"chat"'),
      'utf8',
    );
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Threadplane <hello@cacheplane.ai>',
      to: 'reader@acme.com',
      subject: 'Your Enterprise Guide to Agent Chat Interfaces',
      html: expect.stringContaining('https://threadplane.ai/whitepapers/chat.pdf'),
    }));
    expect(scheduleWhitepaperDripMock).toHaveBeenCalledWith('reader@acme.com', 'chat');
    expect(addToAudienceMock).toHaveBeenCalledWith('reader@acme.com', 'Reader');
    expect(loopsUpsertContactMock).toHaveBeenCalledWith(expect.objectContaining({
      email: 'reader@acme.com',
      firstName: 'Reader',
      source: 'whitepaper-chat',
    }));
    expect(loopsSendEventMock).toHaveBeenCalledWith(expect.objectContaining({
      email: 'reader@acme.com',
      eventName: 'whitepaper_downloaded',
      properties: { paper: 'chat' },
    }));
    expect(captureWhitepaperConversionMock).toHaveBeenCalledWith({
      email: 'reader@acme.com',
      paper: 'chat',
      sourcePage: '/pricing',
    });
  });
});
