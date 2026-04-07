const LOOPS_API_KEY = process.env.LOOPS_API_KEY || '';
const LOOPS_BASE = 'https://app.loops.so/api/v1';

/** Create or update a contact in Loops. Fails silently. */
export async function loopsUpsertContact(opts: {
  email: string;
  firstName?: string;
  source?: string;
  properties?: Record<string, string | number | boolean>;
}) {
  if (!LOOPS_API_KEY) {
    console.info('[loops] skipped (no API key):', opts.email);
    return;
  }
  try {
    const body: Record<string, unknown> = {
      email: opts.email,
      source: opts.source || 'website',
      subscribed: true,
    };
    if (opts.firstName) body.firstName = opts.firstName;
    if (opts.properties) Object.assign(body, opts.properties);

    await fetch(`${LOOPS_BASE}/contacts/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LOOPS_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('[loops] upsertContact failed:', err);
  }
}

/** Send an event to trigger a Loops workflow. Fails silently. */
export async function loopsSendEvent(opts: {
  email: string;
  eventName: string;
  properties?: Record<string, string | number | boolean>;
}) {
  if (!LOOPS_API_KEY) return;
  try {
    await fetch(`${LOOPS_BASE}/events/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LOOPS_API_KEY}`,
      },
      body: JSON.stringify({
        email: opts.email,
        eventName: opts.eventName,
        ...(opts.properties ? { eventProperties: opts.properties } : {}),
      }),
    });
  } catch (err) {
    console.error('[loops] sendEvent failed:', err);
  }
}
