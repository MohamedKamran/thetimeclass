'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { randomId } from '@/lib/id';
import { loadProfile } from '@/lib/profile';

type SignalKind = 'offer' | 'answer' | 'ice' | 'leave';

type SignalMessage = {
  from: string;
  to: string;
  kind: SignalKind;
  payload: any;
  ts: number;
};

type PollResponse = {
  messages: SignalMessage[];
};

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function stopStream(stream: MediaStream | null) {
  if (!stream) return;
  for (const t of stream.getTracks()) t.stop();
}

async function apiJoin(roomId: string, clientId: string) {
  const res = await fetch('/api/signaling/join', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomId, clientId }),
  });
  if (!res.ok) throw new Error('join failed');
  return (await res.json()) as { 
    status: 'waiting' | 'matched'; 
    participants: string[]; 
    others?: string[];
  };
}

async function apiLeave(roomId: string, clientId: string) {
  await fetch('/api/signaling/leave', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomId, clientId }),
  });
}

async function apiSend(roomId: string, from: string, to: string, kind: SignalKind, payload: any) {
  await fetch('/api/signaling/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomId, from, to, kind, payload }),
  });
}

async function apiPoll(roomId: string, to: string, after: number) {
  const res = await fetch(
    `/api/signaling/poll?roomId=${encodeURIComponent(roomId)}&to=${encodeURIComponent(to)}&after=${after}`,
    { cache: 'no-store' },
  );
  if (!res.ok) throw new Error('poll failed');
  return (await res.json()) as PollResponse;
}

function setVideoElStream(video: HTMLVideoElement | null, stream: MediaStream | null) {
  if (!video) return;
  if (video.srcObject !== stream) video.srcObject = stream;
}

export default function MeetingRoom() {
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<ReturnType<typeof loadProfile>>(null);

  const [roomId, setRoomId] = useState('demo');
  const [peerId, setPeerId] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  const clientIdRef = useRef<string>('');
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setProfile(loadProfile());
    
    // Read roomId from URL on client side only
    const url = new URL(window.location.href);
    const roomParam = url.searchParams.get('room');
    if (roomParam) {
      setRoomId(roomParam);
    }
  }, []);

  const teardown = useCallback(
    async (opts?: { leave?: boolean }) => {
      setStatus('idle');
      setPeerId('');

      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }

      if (pcRef.current) {
        try {
          pcRef.current.onicecandidate = null;
          pcRef.current.ontrack = null;
          pcRef.current.onconnectionstatechange = null;
          pcRef.current.close();
        } catch {}
        pcRef.current = null;
      }

      stopStream(localStreamRef.current);
      stopStream(remoteStreamRef.current);

      localStreamRef.current = null;
      remoteStreamRef.current = null;

      setVideoElStream(localVideoRef.current, null);
      setVideoElStream(remoteVideoRef.current, null);

      if (opts?.leave && roomId && clientIdRef.current) {
        try {
          await apiLeave(roomId, clientIdRef.current);
        } catch {}
      }
    },
    [roomId],
  );

  const ensureLocalMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    localStreamRef.current = stream;

    setVideoElStream(localVideoRef.current, stream);

    for (const track of stream.getAudioTracks()) track.enabled = !micMuted;
    for (const track of stream.getVideoTracks()) track.enabled = !camOff;

    return stream;
  }, [micMuted, camOff]);

  const connect = useCallback(async () => {
    await teardown({ leave: true });

    const clientId = randomId();
    clientIdRef.current = clientId;
    lastTsRef.current = 0;

    setStatus('connecting');

    const joinRes = await apiJoin(roomId, clientId);
    const isInitiator = joinRes.status === 'matched' && joinRes.others && joinRes.others.length > 0;
    let currentPeerId = isInitiator && joinRes.others ? joinRes.others[0] : '';
    const iceCandidateQueue: RTCIceCandidateInit[] = [];

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;
    setVideoElStream(remoteVideoRef.current, remoteStream);

    pc.ontrack = (e) => {
      if (e.streams?.[0]) {
        for (const t of e.streams[0].getTracks()) {
          if (!remoteStream.getTracks().some((x) => x.id === t.id)) remoteStream.addTrack(t);
        }
        return;
      }
      if (e.track && !remoteStream.getTracks().some((x) => x.id === e.track.id)) remoteStream.addTrack(e.track);
    };

    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const candidate = e.candidate.toJSON();
      if (currentPeerId) {
        // Send immediately if we know the peer
        apiSend(roomId, clientId, currentPeerId, 'ice', candidate).catch(() => null);
      } else {
        // Queue for later
        iceCandidateQueue.push(candidate);
      }
    };

    const flushIceCandidates = (targetPeer: string) => {
      while (iceCandidateQueue.length > 0) {
        const candidate = iceCandidateQueue.shift();
        apiSend(roomId, clientId, targetPeer, 'ice', candidate).catch(() => null);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setStatus('connected');
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        setStatus('idle');
      }
    };

    const local = await ensureLocalMedia();
    for (const track of local.getTracks()) pc.addTrack(track, local);

    // If we're the second person to join (initiator), create an offer
    if (isInitiator && joinRes.others) {
      for (const other of joinRes.others) {
        currentPeerId = other;
        setPeerId(other);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await apiSend(roomId, clientId, other, 'offer', offer);
        flushIceCandidates(other);
      }
    }

    const poll = async () => {
      try {
        const { messages } = await apiPoll(roomId, clientId, lastTsRef.current);
        for (const m of messages) lastTsRef.current = Math.max(lastTsRef.current, m.ts);

        for (const m of messages) {
          if (m.kind === 'leave') {
            currentPeerId = '';
            setPeerId('');
            continue;
          }

          if (m.kind === 'offer') {
            currentPeerId = m.from;
            setPeerId(m.from);
            await pc.setRemoteDescription(m.payload);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await apiSend(roomId, clientId, m.from, 'answer', answer);
            flushIceCandidates(m.from);
          }

          if (m.kind === 'answer') {
            currentPeerId = m.from;
            setPeerId(m.from);
            await pc.setRemoteDescription(m.payload);
          }

          if (m.kind === 'ice') {
            try {
              await pc.addIceCandidate(m.payload);
            } catch {}
          }
        }
      } catch {
        // ignore
      }
    };

    await poll();
    pollTimerRef.current = window.setInterval(poll, 800);
  }, [ensureLocalMedia, roomId, teardown]);

  useEffect(() => {
    return () => {
      teardown({ leave: true });
    };
  }, [teardown]);

  const onToggleMic = useCallback(() => {
    setMicMuted((v) => {
      const next = !v;
      const stream = localStreamRef.current;
      for (const t of stream?.getAudioTracks() ?? []) t.enabled = !next;
      return next;
    });
  }, []);

  const onToggleCam = useCallback(() => {
    setCamOff((v) => {
      const next = !v;
      const stream = localStreamRef.current;
      for (const t of stream?.getVideoTracks() ?? []) t.enabled = !next;
      return next;
    });
  }, []);

  const onLeave = useCallback(async () => {
    if (peerId) {
      try {
        await apiSend(roomId, clientIdRef.current, peerId, 'leave', null);
      } catch {}
    }
    await teardown({ leave: true });
  }, [peerId, roomId, teardown]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="text-xl font-semibold">Meet</div>
          <div className="text-sm text-neutral-600 dark:text-neutral-300">
            {profile?.name ? `${profile.name} • ` : ''}Room: <span className="font-mono">{roomId}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            className="w-48 rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none dark:border-neutral-700"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="room id"
          />
          <Button onClick={connect} disabled={status === 'connecting' || status === 'connected'}>
            {status === 'idle' ? 'Join' : status === 'connecting' ? 'Connecting…' : 'Connected'}
          </Button>
          <Button onClick={onLeave} variant="secondary">
            Leave
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="p-3 text-sm font-medium">You</div>
          <div className="aspect-video bg-black">
            <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="p-3 text-sm font-medium">Remote {peerId ? <span className="font-mono">({peerId})</span> : null}</div>
          <div className="aspect-video bg-black">
            <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="text-sm text-neutral-600 dark:text-neutral-300">Status: {status}</div>
          <div className="flex items-center gap-2">
            <Button onClick={onToggleMic} variant={micMuted ? 'secondary' : 'primary'}>
              {micMuted ? 'Unmute Mic' : 'Mute Mic'}
            </Button>
            <Button onClick={onToggleCam} variant={camOff ? 'secondary' : 'primary'}>
              {camOff ? 'Turn Camera On' : 'Turn Camera Off'}
            </Button>
          </div>
        </div>
      </Card>

      <div className="text-xs text-neutral-600 dark:text-neutral-300">
        Open the same room in another tab/device to connect. This uses the existing HTTP polling signaling (best for demos; not multi-instance safe).
      </div>
    </div>
  );
}
