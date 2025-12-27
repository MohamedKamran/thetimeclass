import { NextResponse } from 'next/server';
import { pollMessages, cleanup } from '@/lib/signalingStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  cleanup();
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get('roomId');
  const to = searchParams.get('to');
  const after = Number(searchParams.get('after') ?? '0');

  if (!roomId || !to) return NextResponse.json({ error: 'roomId and to required' }, { status: 400 });

  const messages = pollMessages(roomId, to, Number.isFinite(after) ? after : 0);
  return NextResponse.json({ messages });
}
