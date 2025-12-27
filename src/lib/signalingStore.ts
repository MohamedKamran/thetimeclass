export type SignalMessage = {
  from: string;
  to: string;
  kind: 'offer' | 'answer' | 'ice' | 'leave';
  payload: any;
  ts: number;
};

type Room = {
  a: string;
  b: string;
  createdAt: number;
  messages: SignalMessage[];
  participants: string[]; // For room-based joining
};

declare global {
  // eslint-disable-next-line no-var
  var __uniOmegleRooms: Map<string, Room> | undefined;
  // eslint-disable-next-line no-var
  var __uniOmegleWaiting: string[] | undefined;
}

const rooms = (globalThis.__uniOmegleRooms ??= new Map<string, Room>());
const waiting = (globalThis.__uniOmegleWaiting ??= []);

function findRoomForClient(clientId: string): { roomId: string; room: Room } | null {
  for (const [roomId, room] of rooms.entries()) {
    if (room.a === clientId || room.b === clientId || room.participants.includes(clientId)) {
      return { roomId, room };
    }
  }
  return null;
}

// Room-based joining (for MeetingRoom - like Google Meet)
export function joinRoom(roomId: string, clientId: string) {
  let room = rooms.get(roomId);
  
  if (!room) {
    // Create new room
    room = {
      a: clientId,
      b: '',
      createdAt: Date.now(),
      messages: [],
      participants: [clientId],
    };
    rooms.set(roomId, room);
    return { status: 'waiting' as const, participants: [clientId] };
  }
  
  // Room exists, add participant if not already in
  if (!room.participants.includes(clientId)) {
    room.participants.push(clientId);
    if (!room.b && room.a !== clientId) {
      room.b = clientId;
    }
  }
  
  // Return other participants
  const others = room.participants.filter((p) => p !== clientId);
  return { 
    status: others.length > 0 ? 'matched' as const : 'waiting' as const, 
    participants: room.participants,
    others,
  };
}

// Queue-based matching (for ChatScreen - like Omegle)
export function joinQueue(clientId: string) {
  // First check if client is already in a room (already matched)
  const existingRoom = findRoomForClient(clientId);
  if (existingRoom) {
    const peerId = existingRoom.room.a === clientId ? existingRoom.room.b : existingRoom.room.a;
    return {
      status: 'matched' as const,
      roomId: existingRoom.roomId,
      peerId,
      initiator: clientId < peerId,
    };
  }

  // Check if already waiting
  const existingIdx = waiting.indexOf(clientId);
  if (existingIdx !== -1) {
    // Already waiting, just return waiting status
    return { status: 'waiting' as const };
  }

  const other = waiting.shift();
  if (!other) {
    waiting.push(clientId);
    return { status: 'waiting' as const };
  }

  const roomId = [clientId, other].sort().join('-');
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      a: clientId,
      b: other,
      createdAt: Date.now(),
      messages: [],
      participants: [clientId, other],
    });
  }

  return {
    status: 'matched' as const,
    roomId,
    peerId: other,
    initiator: clientId < other,
  };
}

export function leaveQueue(clientId: string) {
  const idx = waiting.indexOf(clientId);
  if (idx !== -1) waiting.splice(idx, 1);
}

export function getRoom(roomId: string) {
  return rooms.get(roomId) ?? null;
}

export function pushMessage(roomId: string, msg: SignalMessage) {
  const room = rooms.get(roomId);
  if (!room) return false;
  room.messages.push(msg);
  if (room.messages.length > 200) room.messages.splice(0, room.messages.length - 200);
  return true;
}

export function pollMessages(roomId: string, to: string, afterTs: number) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return room.messages.filter((m) => m.to === to && m.ts > afterTs);
}

export function closeRoom(roomId: string) {
  rooms.delete(roomId);
}

export function cleanup() {
  const now = Date.now();
  for (const [id, room] of rooms.entries()) {
    if (now - room.createdAt > 1000 * 60 * 30) rooms.delete(id);
  }
}
