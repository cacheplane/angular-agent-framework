import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const UNSUB_FILE = path.join(process.cwd(), 'data', 'unsubscribed.ndjson');

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();

  if (!email || !email.includes('@')) {
    return new NextResponse('Invalid email', { status: 400 });
  }

  // Persist unsubscribe
  try {
    fs.mkdirSync(path.dirname(UNSUB_FILE), { recursive: true });
    fs.appendFileSync(UNSUB_FILE, JSON.stringify({ email, ts: new Date().toISOString() }) + '\n', 'utf8');
  } catch (err) {
    console.error('[unsubscribe] write failed:', err);
  }

  // Return a simple confirmation page
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
    <body style="font-family:Inter,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f4f4f5;margin:0">
    <div style="text-align:center;padding:40px">
      <p style="font-size:18px;font-weight:700;color:#1a1a2e;margin:0 0 8px">You've been unsubscribed</p>
      <p style="font-size:14px;color:#71717a;margin:0">You won't receive any more emails from us.</p>
    </div></body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}
