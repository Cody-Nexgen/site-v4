"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Copy, DoorOpen, Loader2, Mic, MicOff, Users, Video, VideoOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";

type FocusRoom = {
  title: string;
  endsAt: string;
  participantCount: number;
  members: { username: string; displayName: string; avatarUrl: string | null }[];
};

function formatCountdown(endsAt: string): string {
  const sec = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function focusRoomUrl(roomId: string) {
  return `https://focuznow.com/room/${roomId}`;
}

async function getFocusRoom(roomId: string): Promise<{ ok: boolean; room?: FocusRoom; error?: string }> {
  const { data, error } = await supabase.rpc("get_focus_room", { p_room_id: roomId });
  if (error) return { ok: false, error: error.message };
  const row = data as { ok?: boolean; room?: FocusRoom; error?: string } | null;
  if (!row?.ok || !row.room) return { ok: false, error: row?.error ?? "ROOM_NOT_FOUND" };
  return { ok: true, room: row.room };
}

async function joinFocusRoom(roomId: string) {
  const { data, error } = await supabase.rpc("join_focus_room", { p_room_id: roomId });
  if (error) return { ok: false, error: error.message };
  const row = data as { ok?: boolean; error?: string } | null;
  return { ok: !!row?.ok, error: row?.error };
}

async function leaveFocusRoom(roomId: string) {
  await supabase.rpc("leave_focus_room", { p_room_id: roomId });
}

function VideoTile({
  stream,
  label,
  isLocal,
}: {
  stream: MediaStream | null;
  label: string;
  isLocal?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  const hasVideo = stream?.getVideoTracks().some((t) => t.enabled) ?? false;

  return (
    <div className="relative aspect-video rounded-xl overflow-hidden bg-[#1a1a1f] border border-white/10">
      {hasVideo ? (
        <video ref={ref} autoPlay playsInline muted={isLocal} className="w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1e293b] to-[#0f172a]">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl font-black text-white/80">
            {label.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-xs font-bold text-white">{label}</div>
    </div>
  );
}

export default function FocusRoomPage({ roomId }: { roomId: string }) {
  const [session, setSession] = useState<{ user: { email?: string; user_metadata?: { full_name?: string } } } | null>(null);
  const [room, setRoom] = useState<FocusRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [copied, setCopied] = useState(false);

  const displayName =
    session?.user?.user_metadata?.full_name || session?.user?.email?.split("@")[0] || "Guest";

  const pollRoom = useCallback(async () => {
    const res = await getFocusRoom(roomId);
    if (res.ok && res.room) {
      setRoom(res.room);
      setCountdown(formatCountdown(res.room.endsAt));
      setError("");
    } else {
      setRoom(null);
      setError(res.error === "ROOM_NOT_FOUND" ? "Room not found or expired" : res.error ?? "Could not load room");
    }
  }, [roomId]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      if (session) await joinFocusRoom(roomId);
      await pollRoom();
      setLoading(false);
    })();
  }, [roomId, session, pollRoom]);

  useEffect(() => {
    if (!room) return;
    const poll = window.setInterval(() => void pollRoom(), 5000);
    const tick = window.setInterval(() => setCountdown(formatCountdown(room.endsAt)), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [room, pollRoom]);

  useEffect(() => {
    if (!session || !room) return;
    void navigator.mediaDevices
      .getUserMedia({ audio: true, video: camOn })
      .then((stream) => setLocalStream(stream))
      .catch(() => setError("Allow microphone access to join voice"));
    return () => localStream?.getTracks().forEach((t) => t.stop());
  }, [session, room, camOn]);

  const toggleMic = () => {
    const track = localStream?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  };

  const toggleCam = async () => {
    const next = !camOn;
    setCamOn(next);
    if (!localStream) return;
    const vt = localStream.getVideoTracks()[0];
    if (vt) vt.enabled = next;
    else if (next) {
      try {
        const cam = await navigator.mediaDevices.getUserMedia({ video: true });
        const t = cam.getVideoTracks()[0];
        localStream.addTrack(t);
        setLocalStream(new MediaStream(localStream.getTracks()));
      } catch {
        setCamOn(false);
      }
    }
  };

  const copyLink = () => {
    void navigator.clipboard.writeText(focusRoomUrl(roomId)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center p-6">
        <GlassCard className="max-w-md w-full p-8 text-center">
          <Users className="mx-auto mb-4 text-sky-400" size={32} />
          <h1 className="text-xl font-black text-white mb-2">Focus Room</h1>
          <p className="text-sm text-neutral-400 mb-6">Sign in to join this room with voice and video.</p>
          <a
            href={`/login?redirect=${encodeURIComponent(`/room/${roomId}`)}`}
            className="inline-block px-6 py-3 rounded-xl bg-sky-500 text-[#0c1220] font-bold text-sm"
          >
            Sign in to join
          </a>
        </GlassCard>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center">
        <Loader2 className="animate-spin text-sky-400" size={32} />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center p-6">
        <GlassCard className="max-w-md w-full p-8 text-center">
          <p className="text-red-400 font-medium">{error || "Room unavailable"}</p>
          <a href="/" className="mt-4 inline-block text-sm text-neutral-400 hover:text-white">
            Back to focuznow.com
          </a>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white flex flex-col">
      <header className="px-6 py-4 border-b border-white/8 bg-[#111114] flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">Focus Room</p>
          <h1 className="text-lg font-black flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {room.title}
          </h1>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-neutral-500 uppercase">Timer</p>
          <p className="text-3xl font-black text-sky-400 tabular-nums">{countdown}</p>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <VideoTile stream={localStream} label={`${displayName} (you)`} isLocal />
          {room.members
            .filter((m) => m.displayName !== displayName)
            .slice(0, 5)
            .map((m) => (
              <VideoTile key={m.username} stream={null} label={m.displayName} />
            ))}
        </div>

        <p className="text-sm text-neutral-500">{room.participantCount} people focusing together</p>

        <div className="flex flex-wrap gap-3 items-center">
          <button type="button" onClick={toggleMic} className={`p-4 rounded-full ${micOn ? "bg-white/10" : "bg-red-500/20 text-red-400"}`}>
            {micOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button type="button" onClick={() => void toggleCam()} className={`p-4 rounded-full ${camOn ? "bg-white/10" : "bg-white/5 text-neutral-500"}`}>
            {camOn ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
          <button type="button" onClick={copyLink} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/15 text-sky-300 text-sm font-bold">
            <Copy size={14} />
            {copied ? "Copied!" : "Copy invite link"}
          </button>
          <button
            type="button"
            onClick={() => void leaveFocusRoom(roomId)}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 text-red-400 text-sm font-bold"
          >
            <DoorOpen size={14} />
            Leave room
          </button>
        </div>
      </main>
    </div>
  );
}
