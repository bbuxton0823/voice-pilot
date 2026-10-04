// Next.js App Router: save as app/api/jev/route.ts
// Set TYPESAFE_API_KEY in Vercel > Project > Settings > Environment Variables. Never in client code.
import { NextRequest, NextResponse } from 'next/server';

const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-1.13.0'; // pinned so thresholds tuned against it keep holding

// Best-effort limit per instance; Vercel may run several instances.
const hits = new Map<string, { n: number; reset: number }>();
const LIMIT = 60; // requests per minute per address

export async function POST(req: NextRequest) {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) return NextResponse.json({ error: 'Jev is not configured' }, { status: 503 });

  // Only this app may use the route.
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.headers.get('host')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) hits.set(ip, { n: 1, reset: now + 60_000 });
  else if (++h.n > LIMIT) return NextResponse.json({ error: 'Slow down' }, { status: 429 });

  let body: { said?: unknown; room?: unknown; standard?: unknown; question?: unknown; options?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }); }
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const said = str(body.said, 300);
  const question = str(body.question, 200);
  const options = body.options && typeof body.options === 'object' ? (body.options as Record<string, unknown>) : null;
  if (!said || !question || !options) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const criteria: Record<string, string> = {};
  for (const [k, v] of Object.entries(options).slice(0, 254)) {
    if (/^[a-z0-9_]{1,12}$/i.test(k) && typeof v === 'string') criteria[k] = v.slice(0, 400);
  }
  if (!Object.keys(criteria).length) return NextResponse.json({ error: 'No options' }, { status: 400 });
  criteria.none = 'The inspector did not describe any of these.';

  const state: Record<string, string> = { inspector_said: said };
  const room = str(body.room, 60); if (room) state.room = room;
  const standard = str(body.standard, 120); if (standard) state.standard = standard;

  try {
    const r = await fetch(JEV_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, model: MODEL, questions: { pick: { type: 'choice', instructions: question, criteria } } }),
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return NextResponse.json({ error: `Jev returned ${r.status}` }, { status: 502 });
    const data = await r.json();
    const a = data?.answers?.pick;
    if (!a) return NextResponse.json({ error: 'No answer' }, { status: 502 });
    return NextResponse.json({ choice: a.choice, confidence: a.confidence, probabilities: a.probabilities });
  } catch {
    return NextResponse.json({ error: 'Jev unreachable' }, { status: 504 });
  }
}
