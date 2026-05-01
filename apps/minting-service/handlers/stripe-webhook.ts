// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { IncomingMessage } from 'node:http';
import {
  createDb,
  markEventProcessed,
  deleteProcessedEvent,
  upsertLicense,
  getLicense,
  revokeLicense,
} from '@ngaf/db';
import { loadEnv } from '../src/lib/env.js';
import { getStripe } from '../src/lib/stripe.js';
import { mintToken } from '../src/lib/sign.js';
import { sendLicenseEmail } from '../src/lib/email.js';
import { handleEvent, type HandlerDeps } from '../src/lib/handlers.js';

export const config = { api: { bodyParser: false } };

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const env = loadEnv();
  const stripe = getStripe(env.STRIPE_SECRET_KEY);

  const rawBody = await readRawBody(req);
  const sig = req.headers['stripe-signature'];
  if (typeof sig !== 'string') {
    res.status(400).send('missing signature');
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('stripe signature verification failed', err);
    res.status(400).send('invalid signature');
    return;
  }

  const db = createDb(env.DATABASE_URL);
  const deps: HandlerDeps = {
    db,
    stripe,
    markEventProcessed,
    deleteProcessedEvent,
    upsertLicense,
    getLicense,
    revokeLicense,
    mintToken,
    sendLicenseEmail,
    privateKeyHex: env.LICENSE_SIGNING_PRIVATE_KEY_HEX,
    resendApiKey: env.RESEND_API_KEY,
    emailFrom: env.EMAIL_FROM,
    defaultTtlDays: env.LICENSE_DEFAULT_TTL_DAYS,
  };

  try {
    await handleEvent(event, deps);
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('webhook handler error', { eventId: event.id, type: event.type, err });
    res.status(500).send('internal error');
  } finally {
    await db.close();
  }
}
