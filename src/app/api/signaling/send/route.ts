import { NextResponse } from 'next/server';
import { pushMessage } from '@/lib/signalingStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    roomId?: string;
    from?: string;
    to?: string;
    kind?: 'offer' | 'answer' | 'ice' | 'leave';
    payload?: any;
  } | null;

  if (!body?.roomId || !body.from || !body.to || !body.kind)
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const ok = pushMessage(body.roomId, {
    from: body.from,
    to: body.to,
    kind: body.kind,
    payload: body.payload ?? null,
    ts: Date.now(),
  } as any);

  if (!ok) return NextResponse.json({ error: 'room not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
