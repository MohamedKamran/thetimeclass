import { NextResponse } from 'next/server';
import { joinQueue, joinRoom, cleanup } from '@/lib/signalingStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  cleanup();
  const body = (await req.json().catch(() => null)) as { clientId?: string; roomId?: string } | null;
  if (!body?.clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  // If roomId is provided, use room-based joining (MeetingRoom)
  // Otherwise, use queue-based matching (ChatScreen)
  if (body.roomId) {
    const res = joinRoom(body.roomId, body.clientId);
    return NextResponse.json(res);
  }

  const res = joinQueue(body.clientId);
  return NextResponse.json(res);
}
