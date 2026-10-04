// Next.js App Router: save as app/api/learn/route.ts
// Forwards learning events (spoken phrases only) to your own receiver, e.g. tools/learn_receiver.py
// on the DGX Spark behind a Cloudflare Tunnel. Set LEARN_SINK_URL and LEARN_SECRET in Vercel.
import { NextRequest, NextResponse } from 'next/server';

const OUTCOMES = new Set(['unmatched', 'ambiguous', 'corrected', 'jev']);

export async function POST(req: NextRequest) {
  const sink = process.env.LEARN_SINK_URL;
  const secret = process.env.LEARN_SECRET;
  if (!sink || !secret) return NextResponse.json({ error: 'Learning sync is not configured' }, { status: 503 });
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.headers.get('host')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { events?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }); }
  if (!Array.isArray(body.events)) return NextResponse.json({ error: 'No events' }, { status: 400 });

  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const events = body.events.slice(0, 200).map(e => e as Record<string, unknown>)
    .filter(e => OUTCOMES.has(str(e.outcome, 20)) && str(e.said, 200))
    .map(e => ({
      at: str(e.at, 40), said: str(e.said, 200).replace(/\d{3,}/g, '#'), room: str(e.room, 60),
      standard: str(e.standard, 120), outcome: str(e.outcome, 20), chosen: str(e.chosen, 400), area: str(e.area, 10),
    }));
  if (!events.length) return NextResponse.json({ stored: 0 });

  try {
    const r = await fetch(sink, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Learn-Secret': secret },
      body: JSON.stringify({ events }), signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return NextResponse.json({ error: `Receiver returned ${r.status}` }, { status: 502 });
    return NextResponse.json({ stored: events.length });
  } catch {
    return NextResponse.json({ error: 'Receiver unreachable' }, { status: 504 });
  }
}
