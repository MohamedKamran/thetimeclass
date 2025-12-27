'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { clearProfile, loadProfile, type Profile } from '@/lib/profile';
import { randomId } from '@/lib/id';

type ChatMsg = { id: string; from: 'me' | 'peer' | 'system'; text: string; ts: number };

type MatchState =
  | { status: 'idle' }
  | { status: 'waiting' }
  | { status: 'connecting'; roomId: string; peerId: string; initiator: boolean }
  | { status: 'connected'; roomId: string; peerId: string };

type PeerProfile = {
  name: string;
  university: string;
  gender: string;
  major: string;
  interest: string;
};

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// Confetti component
function Confetti({ show }: { show: boolean }) {
  if (!show) return null;
  
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#22c55e', '#eab308', '#3b82f6'];
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: Math.random() * 8 + 6,
    duration: Math.random() * 1 + 2,
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute animate-confetti"
          style={{
            left: `${piece.left}%`,
            top: '-20px',
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
          }}
        />
      ))}
    </div>
  );
}

// Match intro modal
function MatchIntroModal({ 
  peerProfile, 
  onClose 
}: { 
  peerProfile: PeerProfile; 
  onClose: () => void;
}) {
  const pronoun = peerProfile.gender === 'Male' ? 'He' : peerProfile.gender === 'Female' ? 'She' : 'They';
  const hasInterest = peerProfile.gender === 'Male' ? 'has' : peerProfile.gender === 'Female' ? 'has' : 'have';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md animate-scaleIn rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 shadow-2xl shadow-indigo-500/20">
        <div className="mb-4 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-3xl">
            🎉
          </div>
        </div>
        <h2 className="mb-2 text-center text-xl font-bold text-white">Match Found!</h2>
        <div className="mb-4 rounded-xl bg-zinc-800/50 p-4 text-center">
          <p className="text-lg font-semibold text-indigo-300">
            {peerProfile.name} from {peerProfile.university}
          </p>
          <p className="mt-2 text-sm text-zinc-300">
            {pronoun} {hasInterest} interest in <span className="font-medium text-emerald-400">{peerProfile.interest}</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Major: {peerProfile.major}
          </p>
        </div>
        <Button onClick={onClose} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600">
          Start Chatting! 🚀
        </Button>
      </div>
    </div>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<ReturnType<typeof loadProfile>>(null);
  const [peerProfile, setPeerProfile] = useState<PeerProfile | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);

  const clientIdRef = useRef<string>(randomId(10));
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const matchPollTimerRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);

  // Video refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const [match, setMatch] = useState<MatchState>({ status: 'idle' });
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const typingTimer = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setMounted(true);
    const loadedProfile = loadProfile();
    setProfile(loadedProfile);
    
    if (!loadedProfile) {
      router.replace('/setup');
    } else {
      setMessages([
        {
          id: randomId(),
          from: 'system',
          text: 'Welcome to Uni Connect! Click "Start" to find a random student.',
          ts: Date.now(),
        },
      ]);
    }
  }, [router]);

  useEffect(() => {
    return () => {
      stopPolling();
      stopMatchPolling();
      teardownPeer();
      stopLocalMedia();
    };
  }, []);

  // Initialize local media on mount
  useEffect(() => {
    if (mounted) {
      initLocalMedia();
    }
  }, [mounted]);

  async function initLocalMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setMediaError(null);
    } catch (err) {
      console.error('Failed to get media:', err);
      setMediaError('Camera/mic access denied');
    }
  }

  function stopLocalMedia() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
  }

  function toggleCamera() {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setCameraEnabled(prev => !prev);
    }
  }

  function toggleMic() {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setMicEnabled(prev => !prev);
    }
  }

  function pushSystem(text: string) {
    setMessages((m) => [...m, { id: randomId(), from: 'system', text, ts: Date.now() }]);
  }

  function pushPeer(text: string) {
    setMessages((m) => [...m, { id: randomId(), from: 'peer', text, ts: Date.now() }]);
  }

  function pushMe(text: string) {
    setMessages((m) => [...m, { id: randomId(), from: 'me', text, ts: Date.now() }]);
  }

  async function apiJoin() {
    const res = await fetch('/api/signaling/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: clientIdRef.current }),
    });
    if (!res.ok) throw new Error('Join failed');
    return (await res.json()) as
      | { status: 'waiting' }
      | { status: 'matched'; roomId: string; peerId: string; initiator: boolean };
  }

  async function apiLeaveQueue() {
    await fetch('/api/signaling/leave', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: clientIdRef.current }),
    }).catch(() => null);
  }

  async function apiSend(roomId: string, to: string, kind: 'offer' | 'answer' | 'ice' | 'leave', payload: any) {
    await fetch('/api/signaling/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        roomId,
        from: clientIdRef.current,
        to,
        kind,
        payload,
      }),
    });
  }

  async function apiPoll(roomId: string, after: number) {
    const res = await fetch(
      `/api/signaling/poll?roomId=${encodeURIComponent(roomId)}&to=${encodeURIComponent(
        clientIdRef.current,
      )}&after=${after}`,
      { cache: 'no-store' },
    );
    if (!res.ok) throw new Error('Poll failed');
    return (await res.json()) as {
      messages: Array<{ from: string; to: string; kind: 'offer' | 'answer' | 'ice' | 'leave'; payload: any; ts: number }>;
    };
  }

  function stopPolling() {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  function stopMatchPolling() {
    if (matchPollTimerRef.current) {
      window.clearInterval(matchPollTimerRef.current);
      matchPollTimerRef.current = null;
    }
  }

  function startMatchPolling() {
    stopMatchPolling();
    matchPollTimerRef.current = window.setInterval(async () => {
      try {
        const res = await apiJoin();
        if (res.status === 'matched') {
          stopMatchPolling();
          const next: MatchState = {
            status: 'connecting',
            roomId: res.roomId,
            peerId: res.peerId,
            initiator: res.initiator,
          };
          setMatch(next);
          lastTsRef.current = 0;
          startPolling(res.roomId);
          await setupPeer(res.roomId, res.peerId, res.initiator);
          pushSystem('Found someone! Connecting…');
        }
      } catch {
        // ignore transient errors
      }
    }, 1000);
  }

  function startPolling(roomId: string) {
    stopPolling();
    pollTimerRef.current = window.setInterval(async () => {
      try {
        const { messages } = await apiPoll(roomId, lastTsRef.current);
        for (const msg of messages) {
          lastTsRef.current = Math.max(lastTsRef.current, msg.ts);
          await onSignal(roomId, msg.from, msg.kind, msg.payload);
        }
      } catch {
        // ignore transient
      }
    }, 800);
  }

  function teardownPeer() {
    try {
      dcRef.current?.close();
    } catch {}
    dcRef.current = null;

    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;

    // Clear remote video
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    remoteStreamRef.current = null;

    setPeerTyping(false);
    if (typingTimer.current) {
      window.clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }
  }

  async function setupPeer(roomId: string, peerId: string, initiator: boolean) {
    teardownPeer();

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle remote stream
    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;
    
    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) apiSend(roomId, peerId, 'ice', e.candidate.toJSON()).catch(() => null);
    };

    pc.ondatachannel = (e) => {
      dcRef.current = e.channel;
      wireDataChannel(e.channel);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setMatch((m) => (m.status === 'connecting' ? { status: 'connected', roomId: m.roomId, peerId: m.peerId } : m));
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        pushSystem('Connection lost.');
        teardownPeer();
        setMatch({ status: 'idle' });
      }
    };

    if (initiator) {
      const dc = pc.createDataChannel('chat', { ordered: true });
      dcRef.current = dc;
      wireDataChannel(dc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await apiSend(roomId, peerId, 'offer', offer);
    }
  }

  function wireDataChannel(dc: RTCDataChannel) {
    dc.onopen = () => {
      setMatch((m) => (m.status === 'connecting' ? { status: 'connected', roomId: m.roomId, peerId: m.peerId } : m));
      
      // Send our profile to the peer
      if (profile) {
        dc.send(JSON.stringify({ 
          t: 'profile', 
          v: { 
            name: profile.name, 
            university: profile.university,
            gender: profile.gender ?? 'Other',
            major: profile.major ?? 'Unknown',
            interest: profile.interest ?? 'chatting'
          } 
        }));
      }
    };
    dc.onclose = () => {
      pushSystem('Stranger has disconnected.');
      teardownPeer();
      setMatch({ status: 'idle' });
      setPeerProfile(null);
    };
    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(String(e.data)) as { t: 'msg' | 'typing' | 'profile'; v: any };
        if (msg.t === 'msg') {
          pushPeer(String(msg.v ?? ''));
          setPeerTyping(false);
        }
        if (msg.t === 'typing') {
          setPeerTyping(Boolean(msg.v));
          if (typingTimer.current) window.clearTimeout(typingTimer.current);
          typingTimer.current = window.setTimeout(() => setPeerTyping(false), 1500);
        }
        if (msg.t === 'profile') {
          const p = msg.v as PeerProfile;
          setPeerProfile(p);
          // Show confetti and modal
          setShowConfetti(true);
          setShowMatchModal(true);
          // Auto-hide confetti after animation
          setTimeout(() => setShowConfetti(false), 3000);
          // Add intro message
          const pronoun = p.gender === 'Male' ? 'He' : p.gender === 'Female' ? 'She' : 'They';
          const hasInterest = p.gender === 'Male' ? 'has' : p.gender === 'Female' ? 'has' : 'have';
          pushSystem(`${p.name} from ${p.university}. ${pronoun} ${hasInterest} interest in ${p.interest}.`);
        }
      } catch {
        pushPeer(String(e.data));
      }
    };
  }

  async function onSignal(roomId: string, from: string, kind: 'offer' | 'answer' | 'ice' | 'leave', payload: any) {
    const pc = pcRef.current;
    if (!pc) return;

    if (kind === 'leave') {
      teardownPeer();
      pushSystem('Stranger has disconnected.');
      setMatch({ status: 'idle' });
      return;
    }

    if (kind === 'offer') {
      await pc.setRemoteDescription(payload);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await apiSend(roomId, from, 'answer', answer);
      return;
    }

    if (kind === 'answer') {
      await pc.setRemoteDescription(payload);
      return;
    }

    if (kind === 'ice') {
      try {
        await pc.addIceCandidate(payload);
      } catch {
        // ignore
      }
    }
  }

  async function start() {
    if (mediaError) {
      await initLocalMedia();
      if (mediaError) return;
    }
    
    setMessages([{ id: randomId(), from: 'system', text: 'Looking for someone to chat with…', ts: Date.now() }]);
    setMatch({ status: 'waiting' });

    const res = await apiJoin();
    if (res.status === 'waiting') {
      pushSystem('Waiting for another student…');
      startMatchPolling();
      return;
    }

    const next: MatchState = {
      status: 'connecting',
      roomId: res.roomId,
      peerId: res.peerId,
      initiator: res.initiator,
    };
    setMatch(next);
    lastTsRef.current = 0;
    startPolling(res.roomId);
    await setupPeer(res.roomId, res.peerId, res.initiator);
    pushSystem('Found someone! Connecting…');
  }

  async function stopOrSkip() {
    // Reset peer profile and modal state
    setPeerProfile(null);
    setShowMatchModal(false);
    setShowConfetti(false);

    if (match.status === 'waiting') {
      stopMatchPolling();
      await apiLeaveQueue();
      setMatch({ status: 'idle' });
      pushSystem('Stopped searching.');
      return;
    }

    if (match.status === 'connecting' || match.status === 'connected') {
      stopPolling();
      const roomId = match.roomId;
      const peerId = match.peerId;
      await apiSend(roomId, peerId, 'leave', null).catch(() => null);
      teardownPeer();
      setMatch({ status: 'idle' });
      pushSystem('You disconnected.');
      return;
    }
  }

  async function nextPerson() {
    await stopOrSkip();
    setTimeout(() => start(), 100);
  }

  function sendTyping(isTyping: boolean) {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return;
    dc.send(JSON.stringify({ t: 'typing', v: isTyping }));
  }

  function sendMsg() {
    const text = draft.trim();
    if (!text) return;
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return;

    dc.send(JSON.stringify({ t: 'msg', v: text }));
    pushMe(text);
    setDraft('');
    sendTyping(false);
  }

  const canChat = match.status === 'connected';
  const isSearching = match.status === 'waiting' || match.status === 'connecting';

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex h-dvh flex-col bg-zinc-950">
      {/* Confetti effect */}
      <Confetti show={showConfetti} />
      
      {/* Match intro modal */}
      {showMatchModal && peerProfile && (
        <MatchIntroModal 
          peerProfile={peerProfile} 
          onClose={() => setShowMatchModal(false)} 
        />
      )}

      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white">
            U
          </div>
          <div>
            <h1 className="font-bold text-white">Uni Connect</h1>
            <p className="text-[11px] text-zinc-500">Talk to random students</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-zinc-400 sm:block">
            {profile?.name} • {profile?.university}
          </span>
          <Button
            variant="secondary"
            onClick={() => {
              stopOrSkip();
              stopLocalMedia();
              clearProfile();
              router.push('/setup');
            }}
            className="h-8 px-3 text-xs"
          >
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex min-h-0 flex-1">
        {/* Video Section */}
        <div className="flex flex-1 flex-col">
          {/* Videos Grid */}
          <div className="grid flex-1 grid-cols-1 gap-1 p-1 md:grid-cols-2">
            {/* Stranger Video */}
            <div className="relative overflow-hidden rounded-xl bg-zinc-900">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
              {!canChat && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
                  {isSearching ? (
                    <>
                      <div className="mb-3 flex gap-1">
                        <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.3s]" />
                        <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.15s]" />
                        <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-indigo-500" />
                      </div>
                      <p className="text-sm font-medium text-white">Looking for someone…</p>
                    </>
                  ) : (
                    <>
                      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800">
                        <svg className="h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <p className="text-sm text-zinc-400">Stranger</p>
                    </>
                  )}
                </div>
              )}
              <div className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white">
                Stranger
              </div>
              {canChat && peerTyping && (
                <div className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-1 text-xs text-zinc-300">
                  typing…
                </div>
              )}
            </div>

            {/* Your Video */}
            <div className="relative overflow-hidden rounded-xl bg-zinc-800">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
              />
              {mediaError && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 p-4 text-center">
                  <div>
                    <svg className="mx-auto mb-2 h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs text-red-400">{mediaError}</p>
                    <button onClick={initLocalMedia} className="mt-2 text-xs text-indigo-400 underline">
                      Retry
                    </button>
                  </div>
                </div>
              )}
              <div className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white">
                You
              </div>
              {/* Media Controls */}
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                <button
                  onClick={toggleCamera}
                  className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition-colors ${
                    cameraEnabled ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-red-500 text-white'
                  }`}
                  title={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                  {cameraEnabled ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={toggleMic}
                  className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition-colors ${
                    micEnabled ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-red-500 text-white'
                  }`}
                  title={micEnabled ? 'Mute mic' : 'Unmute mic'}
                >
                  {micEnabled ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Control Bar */}
          <div className="flex shrink-0 items-center justify-center gap-3 border-t border-zinc-800 bg-zinc-900 p-3">
            {match.status === 'idle' ? (
              <Button
                onClick={start}
                className="h-12 bg-gradient-to-r from-green-500 to-emerald-600 px-10 text-base font-bold shadow-lg shadow-green-500/20 transition-transform hover:scale-105"
              >
                🎲 Start
              </Button>
            ) : (
              <>
                <Button onClick={stopOrSkip} variant="danger" className="h-10 px-6 font-semibold">
                  ⏹ Stop
                </Button>
                {canChat && (
                  <Button
                    onClick={nextPerson}
                    className="h-10 bg-gradient-to-r from-indigo-500 to-purple-600 px-6 font-semibold shadow-lg shadow-indigo-500/20"
                  >
                    ⏭ Next
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="hidden w-80 flex-col border-l border-zinc-800 bg-zinc-900/50 lg:flex">
          {/* Chat Header */}
          <div className="shrink-0 border-b border-zinc-800 px-4 py-3">
            <h2 className="font-semibold text-white">Chat</h2>
            <p className="text-xs text-zinc-500">
              {match.status === 'connected'
                ? '🟢 Connected'
                : match.status === 'waiting'
                  ? '🟡 Searching…'
                  : match.status === 'connecting'
                    ? '🟡 Connecting…'
                    : '⚪ Not connected'}
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="flex flex-col gap-2">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    m.from === 'me'
                      ? 'ml-auto max-w-[85%] bg-indigo-600 text-white'
                      : m.from === 'peer'
                        ? 'mr-auto max-w-[85%] bg-zinc-700 text-white'
                        : 'mx-auto text-center text-[11px] text-zinc-500'
                  }`}
                >
                  {m.from !== 'system' && (
                    <span className="mb-0.5 block text-[10px] font-medium opacity-60">
                      {m.from === 'me' ? 'You' : 'Stranger'}
                    </span>
                  )}
                  {m.text}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Chat Input */}
          <div className="shrink-0 border-t border-zinc-800 p-3">
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (canChat) sendTyping(e.target.value.trim().length > 0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendMsg();
                  }
                }}
                placeholder={canChat ? 'Type a message…' : 'Connect to chat'}
                disabled={!canChat}
                className="flex-1 text-sm"
              />
              <Button onClick={sendMsg} disabled={!canChat || !draft.trim()} className="h-10 px-4">
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Chat Toggle */}
      <div className="flex shrink-0 flex-col border-t border-zinc-800 bg-zinc-900/80 lg:hidden">
        <div className="max-h-48 overflow-y-auto p-2">
          <div className="flex flex-col gap-1.5">
            {messages.slice(-5).map((m) => (
              <div
                key={m.id}
                className={`rounded-lg px-2.5 py-1.5 text-xs ${
                  m.from === 'me'
                    ? 'ml-auto max-w-[80%] bg-indigo-600 text-white'
                    : m.from === 'peer'
                      ? 'mr-auto max-w-[80%] bg-zinc-700 text-white'
                      : 'mx-auto text-center text-zinc-500'
                }`}
              >
                {m.text}
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 p-2 pt-0">
          <Input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (canChat) sendTyping(e.target.value.trim().length > 0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                sendMsg();
              }
            }}
            placeholder={canChat ? 'Type…' : 'Connect first'}
            disabled={!canChat}
            className="flex-1 text-sm"
          />
          <Button onClick={sendMsg} disabled={!canChat || !draft.trim()} className="h-10 px-3 text-sm">
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
