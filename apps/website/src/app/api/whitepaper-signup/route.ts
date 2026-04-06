// apps/website/src/app/api/whitepaper-signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SIGNUPS_FILE = path.join(process.cwd(), 'data', 'whitepaper-signups.ndjson');

export async function POST(req: NextRequest) {
  let body: { name?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name = '', email = '' } = body;
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  const entry = JSON.stringify({ name: name.trim(), email: email.trim(), ts: new Date().toISOString() }) + '\n';
  try {
    fs.mkdirSync(path.dirname(SIGNUPS_FILE), { recursive: true });
    fs.appendFileSync(SIGNUPS_FILE, entry, 'utf8');
  } catch (err) {
    console.error('Failed to write signup:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
