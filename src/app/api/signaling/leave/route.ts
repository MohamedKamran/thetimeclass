import { NextResponse } from 'next/server';
import { leaveQueue } from '@/lib/signalingStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { clientId?: string } | null;
  if (!body?.clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  leaveQueue(body.clientId);
  return NextResponse.json({ ok: true });
}
