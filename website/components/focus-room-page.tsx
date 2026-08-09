"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check, ChevronUp, Copy, DoorOpen, Download, Loader2, MessageSquare, Mic, MicOff, MoreVertical,
  Paperclip, Shield, Trash2, Users, Video, VideoOff, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  deleteAttachment, downloadAttachment, getAttachmentPlayUrl, isPlayableAttachmentMime,
  uploadRoomAttachment, type AttachmentRecord,
} from "@/lib/attachmentApi";
import { useWebsiteFocusRoomRtc, type RoomDevicePrefs, type RoomPeer } from "@/lib/focusRoomRtc";

type FocusRoom = {
  id: string;
  hostId?: string;
  title: string;
  endsAt: string;
  participantCount: number;
  members: { username: string; displayName: string; avatarUrl: string | null }[];
};

function ChatAttachmentMedia({
  attachment,
  canDelete,
  onDownload,
  onDelete,
}: {
  attachment: AttachmentRecord;
  canDelete: boolean;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const kind = isPlayableAttachmentMime(attachment.mimeType);
  const [url, setUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!kind) return;
    let cancelled = false;
    void getAttachmentPlayUrl(attachment).then((result) => {
      if (cancelled) return;
      if (result.ok) setUrl(result.url);
      else setLoadError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [attachment, kind]);

  return (
    <div className="mt-1 space-y-1.5 rounded-lg border border-white/10 bg-black/20 p-2">
      {kind === "image" && url && (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          <img src={url} alt={attachment.fileName} className="max-h-48 w-full rounded-md object-contain bg-black/40" />
        </a>
      )}
      {kind === "video" && url && (
        <video src={url} controls playsInline preload="metadata" className="max-h-56 w-full rounded-md bg-black/40" />
      )}
      {kind === "audio" && url && <audio src={url} controls preload="metadata" className="w-full" />}
      {kind && !url && !loadError && <p className="text-[10px] text-neutral-500">Loading media…</p>}
      {loadError && <p className="text-[10px] text-red-400">{loadError}</p>}
      <div className="flex items-center gap-2">
        <Paperclip size={13} className="text-neutral-500" />
        <span className="min-w-0 flex-1 truncate text-xs">{attachment.fileName}</span>
        <button type="button" onClick={onDownload}><Download size={13} /></button>
        {canDelete && (
          <button type="button" className="text-red-400" onClick={onDelete}><Trash2 size={13} /></button>
        )}
      </div>
    </div>
  );
}

function formatCountdown(endsAt: string) {
  const seconds = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

async function getRoom(roomId: string) {
  const { data, error } = await supabase.rpc("get_focus_room", { p_room_id: roomId });
  if (error) return { ok: false as const, error: error.message };
  const result = data as { ok?: boolean; room?: FocusRoom; error?: string } | null;
  return result?.ok && result.room
    ? { ok: true as const, room: result.room }
    : { ok: false as const, error: result?.error ?? "ROOM_NOT_FOUND" };
}

function DeviceToggleButton({
  active,
  onToggle,
  icon,
  offIcon,
  label,
  menuTitle,
  sections,
  open,
  onOpenChange,
}: {
  active: boolean;
  onToggle: () => void;
  icon: ReactNode;
  offIcon: ReactNode;
  label: string;
  menuTitle: string;
  sections: { heading: string; devices: MediaDeviceInfo[]; selectedId: string; onSelect: (id: string) => void; emptyLabel: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="relative flex items-stretch">
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        className={`flex h-12 w-12 items-center justify-center rounded-l-full ${active ? "bg-white/10 hover:bg-white/15" : "bg-red-500/20 text-red-400"}`}
      >
        {active ? icon : offIcon}
      </button>
      <button
        type="button"
        aria-label={`${menuTitle} options`}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={`flex h-12 w-5 items-center justify-center rounded-r-full border-l border-black/30 ${active ? "bg-white/10 hover:bg-white/15" : "bg-red-500/20 text-red-400"}`}
      >
        <ChevronUp size={12} className={`transition-transform ${open ? "" : "rotate-180"}`} />
      </button>
      {open && (
        <div className="absolute bottom-[calc(100%+10px)] left-1/2 z-50 max-h-72 w-64 -translate-x-1/2 overflow-y-auto rounded-xl border border-white/10 bg-[#111214]/95 py-1.5 shadow-2xl backdrop-blur-xl">
          <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">{menuTitle}</p>
          {sections.map((section) => (
            <div key={section.heading} className="mb-1">
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">{section.heading}</p>
              {section.devices.length === 0 ? (
                <p className="px-3 py-1.5 text-xs text-neutral-600">{section.emptyLabel}</p>
              ) : (
                section.devices.map((device) => {
                  const selected = device.deviceId === section.selectedId || (!section.selectedId && section.devices[0]?.deviceId === device.deviceId);
                  return (
                    <button
                      key={device.deviceId}
                      type="button"
                      onClick={() => {
                        section.onSelect(device.deviceId);
                        onOpenChange(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-200 hover:bg-white/[0.06]"
                    >
                      <span className="w-4 shrink-0 text-emerald-400">{selected ? <Check size={12} /> : null}</span>
                      <span className="truncate">{device.label || section.heading}</span>
                    </button>
                  );
                })
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ParticipantTile({ peer, speakerId }: { peer: RoomPeer; speakerId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasVideo = peer.stream?.getVideoTracks().some((track) => track.enabled) ?? false;
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = hasVideo ? peer.stream : null;
    if (!peer.isLocal && audioRef.current) {
      audioRef.current.srcObject = peer.stream;
      if (speakerId && "setSinkId" in audioRef.current) {
        void (audioRef.current as HTMLAudioElement & { setSinkId(id: string): Promise<void> })
          .setSinkId(speakerId).catch(() => {});
      }
      void audioRef.current.play().catch(() => {});
    }
  }, [hasVideo, peer.isLocal, peer.stream, speakerId]);
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-[#121214]">
      {!peer.isLocal && <audio ref={audioRef} autoPlay playsInline className="hidden" />}
      {hasVideo ? (
        <video ref={videoRef} autoPlay playsInline muted={peer.isLocal} className="h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {peer.avatarUrl ? (
            <img src={peer.avatarUrl} alt="" className="h-20 w-20 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 text-2xl font-bold">
              {peer.displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs font-semibold">
        {peer.displayName}
      </span>
    </div>
  );
}

export default function FocusRoomPage({ roomId }: { roomId: string }) {
  const [session, setSession] = useState<any>(null);
  const [room, setRoom] = useState<FocusRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [inRoom, setInRoom] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState("");
  const [copied, setCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [hostOpen, setHostOpen] = useState(false);
  const [micMenuOpen, setMicMenuOpen] = useState(false);
  const [camMenuOpen, setCamMenuOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [prefs, setPrefs] = useState<RoomDevicePrefs>({
    micId: "", speakerId: "", cameraId: "", noiseSuppression: true, echoCancellation: true,
  });
  const previewRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const displayName = session?.user?.user_metadata?.full_name || session?.user?.email?.split("@")[0] || "Focus";
  const avatarUrl = session?.user?.user_metadata?.avatar_url ?? null;
  const isHost = Boolean(room?.hostId && room.hostId === session?.user?.id);

  const rtc = useWebsiteFocusRoomRtc({
    roomId,
    displayName,
    avatarUrl,
    enabled: inRoom,
    isHost,
    prefs,
    accountUserId: session?.user?.id ?? null,
  });

  const pollRoom = useCallback(async () => {
    const result = await getRoom(roomId);
    if (result.ok) {
      setRoom(result.room);
      setCountdown(formatCountdown(result.room.endsAt));
      setError("");
    } else {
      setRoom(null);
      setError(result.error === "ROOM_NOT_FOUND" ? "Room not found or expired." : result.error);
    }
  }, [roomId]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void pollRoom().finally(() => setLoading(false));
  }, [pollRoom]);

  useEffect(() => {
    if (!session?.user?.id) return;
    void supabase.from("subscriptions").select("status").eq("user_id", session.user.id)
      .in("status", ["active", "trialing"]).limit(1).maybeSingle()
      .then(({ data }) => setIsPro(Boolean(data)));
  }, [session?.user?.id]);

  useEffect(() => {
    if (!room) return;
    const poll = window.setInterval(() => void pollRoom(), 5000);
    const tick = window.setInterval(() => setCountdown(formatCountdown(room.endsAt)), 1000);
    return () => { window.clearInterval(poll); window.clearInterval(tick); };
  }, [pollRoom, room]);

  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = rtc.camOn ? rtc.localStream : null;
  }, [rtc.camOn, rtc.localStream]);

  const join = async () => {
    setJoining(true);
    const { data, error: joinError } = await supabase.rpc("join_focus_room", { p_room_id: roomId });
    setJoining(false);
    const result = data as { ok?: boolean; error?: string } | null;
    if (joinError || !result?.ok) {
      setError(joinError?.message ?? result?.error ?? "Could not join room.");
      return;
    }
    setInRoom(true);
    void pollRoom();
  };

  const leave = async () => {
    await supabase.rpc("leave_focus_room", { p_room_id: roomId });
    setInRoom(false);
    window.location.href = "/";
  };

  const upload = async (file: File) => {
    if (!isPro) {
      setError("Chat attachments are available on Pro.");
      return;
    }
    setUploading(true);
    const result = await uploadRoomAttachment(file, roomId);
    setUploading(false);
    if (!result.ok) setError(result.error);
    else rtc.sendChat("", { ...result.attachment, extractedText: null });
  };

  const removeAttachment = async (attachment: AttachmentRecord) => {
    const result = await deleteAttachment(attachment);
    if (!result.ok) setError(result.error);
    else rtc.removeChatAttachment(attachment.id);
  };

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b] p-6 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121214] p-8 text-center">
          <Users className="mx-auto mb-4 text-neutral-500" size={36} />
          <h1 className="text-2xl font-bold">Focus Room</h1>
          <p className="mt-2 text-sm text-neutral-400">Sign in to join this voice and video session.</p>
          <a href={`/login?redirect=${encodeURIComponent(`/room/${roomId}`)}`} className="mt-6 inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-black">
            Sign in to join
          </a>
        </div>
      </div>
    );
  }
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b]"><Loader2 className="animate-spin text-white" /></div>;
  if (!room) return <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b] p-6 text-red-400">{error || "Room unavailable"}</div>;

  if (!inRoom) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#070708] text-white lg:h-screen">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 20% 20%, rgba(88,101,242,0.14), transparent 55%), radial-gradient(ellipse 60% 40% at 85% 70%, rgba(16,185,129,0.08), transparent 50%)",
          }}
        />
        <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
          <section className="flex items-center border-b border-white/10 p-6 lg:border-b-0 lg:border-r lg:p-12">
            <div className="mx-auto w-full max-w-2xl">
              <div className="relative aspect-video overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl">
                <video ref={previewRef} autoPlay muted playsInline className={`h-full w-full object-cover ${rtc.camOn ? "" : "hidden"}`} />
                {!rtc.camOn && <div className="absolute inset-0 flex items-center justify-center text-neutral-500">Camera off</div>}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={rtc.toggleMic} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.06] p-3 text-sm backdrop-blur-md">
                  {rtc.micOn ? <Mic size={16} /> : <MicOff size={16} />} Microphone
                </button>
                <button onClick={() => void rtc.toggleCam()} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.06] p-3 text-sm backdrop-blur-md">
                  {rtc.camOn ? <Video size={16} /> : <VideoOff size={16} />} Camera
                </button>
              </div>
            </div>
          </section>
          <section className="flex items-center p-6 lg:p-12">
            <div className="mx-auto w-full max-w-lg rounded-3xl border border-white/[0.1] bg-white/[0.04] p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:p-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-400/90">Waiting lobby</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">{room.title}</h1>
              <p className="mt-2 text-sm text-neutral-400">Choose your devices before joining · {countdown} remaining</p>
              <div className="mt-8 space-y-4">
                {([
                  ["Camera", prefs.cameraId || rtc.selectedCameraId, rtc.videoInputs, "cameraId"],
                  ["Microphone", prefs.micId || rtc.selectedMicId, rtc.audioInputs, "micId"],
                  ["Speaker", prefs.speakerId || rtc.selectedSpeakerId, rtc.audioOutputs, "speakerId"],
                ] as const).map(([label, value, devices, key]) => (
                  <label key={label} className="block rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-xs text-neutral-400">
                    {label}
                    <select
                      value={value}
                      onChange={(event) => {
                        const id = event.target.value;
                        setPrefs((current) => ({ ...current, [key]: id }));
                        if (key === "cameraId") void rtc.selectCamera(id);
                        if (key === "micId") void rtc.selectMic(id);
                        if (key === "speakerId") rtc.selectSpeaker(id);
                      }}
                      className="mt-1.5 w-full bg-transparent p-1 text-sm text-white outline-none"
                    >
                      <option value="">Default {label.toLowerCase()}</option>
                      {devices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || label}</option>)}
                    </select>
                  </label>
                ))}
                <div className="flex gap-5 text-sm text-neutral-300">
                  <label><input type="checkbox" checked={prefs.noiseSuppression} onChange={(e) => setPrefs((p) => ({ ...p, noiseSuppression: e.target.checked }))} /> Noise suppression</label>
                  <label><input type="checkbox" checked={prefs.echoCancellation} onChange={(e) => setPrefs((p) => ({ ...p, echoCancellation: e.target.checked }))} /> Echo cancellation</label>
                </div>
              </div>
              {error && <p className="mt-4 text-sm text-amber-400">{error}</p>}
              <button disabled={joining || rtc.permission === "denied"} onClick={() => void join()} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-white p-3 font-bold text-black disabled:opacity-40">
                {joining && <Loader2 size={17} className="animate-spin" />} Join Focus Room
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0a0b] text-white">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <div className="min-w-0">
          <h1 className="truncate font-semibold">{room.title}</h1>
          <p className="text-[10px] text-neutral-500">
            {rtc.participants.length} connected
            {room.participantCount !== rtc.participants.length
              ? ` · ${room.participantCount} joined`
              : " in room"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {rtc.roomLocked && <Shield size={15} className="text-amber-400" />}
          <span className="font-semibold tabular-nums">{countdown}</span>
          <button
            title="Both people must open this exact room link"
            onClick={() => void navigator.clipboard.writeText(`https://focuznow.com/room/${roomId}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
            className="flex flex-col items-end gap-0.5 text-xs text-neutral-400"
          >
            <span className="flex items-center gap-1"><Copy size={13} /> {copied ? "Copied" : "Invite"}</span>
            <span className="max-w-[180px] truncate font-mono text-[10px] text-neutral-500">{roomId}</span>
          </button>
        </div>
      </header>
      <main className="flex min-h-0 flex-1">
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rtc.participants.map((peer) => <ParticipantTile key={peer.peerId} peer={peer} speakerId={prefs.speakerId || rtc.selectedSpeakerId} />)}
          </div>
          {rtc.participants.length <= 1 && (
            <div className="mx-auto mt-6 max-w-lg space-y-2 px-4 text-center">
              <p className="text-sm text-neutral-400">Waiting for others to connect…</p>
              <p className="break-all font-mono text-xs text-white/90">Room: {roomId}</p>
              {rtc.error ? <p className="text-xs text-amber-400">{rtc.error}</p> : null}
            </div>
          )}
        </div>
        {chatOpen && (
          <aside
            className="absolute inset-y-14 right-0 z-30 flex w-full max-w-sm flex-col border-l border-white/10 bg-[#171719] sm:static sm:inset-auto"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void upload(file); }}
          >
            <div className="flex h-12 items-center justify-between border-b border-white/10 px-3"><b>Chat</b><button onClick={() => setChatOpen(false)}><X size={16} /></button></div>
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {rtc.chat.map((message) => (
                <div key={message.id} className="text-sm">
                  <p className="text-[11px] font-semibold text-neutral-500">{message.name}</p>
                  {message.text && <p className="break-words text-neutral-200">{message.text}</p>}
                  {message.attachment && (
                    <ChatAttachmentMedia
                      attachment={message.attachment}
                      canDelete={message.attachment.ownerId === session.user.id}
                      onDownload={() => void downloadAttachment(message.attachment!).then((result) => {
                        if (!result.ok) setError(result.error);
                      })}
                      onDelete={() => void removeAttachment(message.attachment!)}
                    />
                  )}
                </div>
              ))}
            </div>
            {error && <div className="mx-3 rounded bg-amber-400/10 p-2 text-xs text-amber-300">{error}{!isPro && <a href="/pricing" className="ml-2 font-bold underline">Upgrade</a>}</div>}
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} />
            <form onSubmit={(e) => { e.preventDefault(); rtc.sendChat(chatDraft); setChatDraft(""); }} className="flex gap-2 border-t border-white/10 p-3">
              <button type="button" disabled={uploading} onClick={() => isPro ? fileRef.current?.click() : setError("Chat attachments are available on Pro.")} className="rounded-lg bg-black/30 p-2">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
              </button>
              <input value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} placeholder="Message…" className="min-w-0 flex-1 rounded-lg bg-black/30 px-3 text-sm outline-none" />
            </form>
          </aside>
        )}
      </main>
      <footer className="relative flex h-[72px] shrink-0 items-center justify-center gap-2 border-t border-white/10 bg-[#171719] px-3">
        <DeviceToggleButton
          active={rtc.micOn}
          onToggle={rtc.toggleMic}
          icon={<Mic size={19} />}
          offIcon={<MicOff size={19} />}
          label={rtc.micOn ? "Mute microphone" : "Unmute microphone"}
          menuTitle="Audio devices"
          open={micMenuOpen}
          onOpenChange={(open) => { setMicMenuOpen(open); if (open) setCamMenuOpen(false); }}
          sections={[
            {
              heading: "Microphone",
              devices: rtc.audioInputs,
              selectedId: rtc.selectedMicId,
              onSelect: (id) => { setPrefs((p) => ({ ...p, micId: id })); void rtc.selectMic(id); },
              emptyLabel: "No microphones found",
            },
            {
              heading: "Speaker",
              devices: rtc.audioOutputs,
              selectedId: rtc.selectedSpeakerId,
              onSelect: (id) => { setPrefs((p) => ({ ...p, speakerId: id })); rtc.selectSpeaker(id); },
              emptyLabel: "No speakers found",
            },
          ]}
        />
        <DeviceToggleButton
          active={rtc.camOn}
          onToggle={() => void rtc.toggleCam()}
          icon={<Video size={19} />}
          offIcon={<VideoOff size={19} />}
          label={rtc.camOn ? "Turn off camera" : "Turn on camera"}
          menuTitle="Video devices"
          open={camMenuOpen}
          onOpenChange={(open) => { setCamMenuOpen(open); if (open) setMicMenuOpen(false); }}
          sections={[
            {
              heading: "Camera",
              devices: rtc.videoInputs,
              selectedId: rtc.selectedCameraId,
              onSelect: (id) => { setPrefs((p) => ({ ...p, cameraId: id })); void rtc.selectCamera(id); },
              emptyLabel: "No cameras found",
            },
          ]}
        />
        <button onClick={() => setChatOpen((open) => !open)} className="rounded-full bg-white/10 p-4"><MessageSquare size={19} /></button>
        {isHost && (
          <div className="relative">
            <button onClick={() => setHostOpen((open) => !open)} className="rounded-full bg-white/10 p-4"><MoreVertical size={19} /></button>
            {hostOpen && (
              <div className="absolute bottom-14 right-0 w-56 rounded-xl border border-white/10 bg-[#111214] p-2 shadow-2xl">
                <p className="px-2 py-1 text-[10px] font-bold uppercase text-neutral-500">Host controls</p>
                {rtc.participants.filter((peer) => !peer.isLocal).map((peer) => (
                  <div key={peer.peerId} className="flex">
                    <button onClick={() => rtc.mutePeer(peer.peerId)} className="flex-1 rounded px-2 py-1.5 text-left text-xs hover:bg-white/5">Mute {peer.displayName}</button>
                    <button onClick={() => rtc.kickPeer(peer.peerId)} className="px-2 text-xs text-red-400">Remove</button>
                  </div>
                ))}
                <button onClick={() => rtc.setRoomLock(!rtc.roomLocked)} className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-white/5"><Shield size={12} className="mr-2 inline" />{rtc.roomLocked ? "Unlock room" : "Lock room"}</button>
                <button onClick={() => { rtc.endSession(); void leave(); }} className="w-full rounded px-2 py-1.5 text-left text-xs text-red-400 hover:bg-white/5">End session for all</button>
              </div>
            )}
          </div>
        )}
        <button onClick={() => void leave()} className="ml-2 flex items-center gap-2 rounded-lg bg-red-500 px-4 py-3 text-sm font-bold"><DoorOpen size={16} />Leave</button>
        {rtc.error && <p className="absolute bottom-20 rounded bg-black/80 px-3 py-1 text-xs text-amber-400">{rtc.error}</p>}
      </footer>
    </div>
  );
}
