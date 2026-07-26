"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { AttachmentRecord } from "@/lib/attachmentApi";

export type RoomPeer = {
  peerId: string;
  displayName: string;
  avatarUrl?: string | null;
  stream: MediaStream | null;
  isLocal?: boolean;
};

export type RoomChatMessage = {
  id: string;
  from: string;
  name: string;
  text: string;
  at: number;
  attachment?: AttachmentRecord;
};

type Signal = {
  from: string;
  to: string;
  type: "offer" | "answer" | "ice" | "mute" | "room-lock" | "end-session";
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  locked?: boolean;
  name?: string;
  avatarUrl?: string | null;
};

export type RoomDevicePrefs = {
  micId: string;
  speakerId: string;
  cameraId: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function peerId() {
  return `peer_${Math.random().toString(36).slice(2, 10)}`;
}

export function useWebsiteFocusRoomRtc({
  roomId,
  displayName,
  avatarUrl,
  enabled,
  isHost,
  prefs,
}: {
  roomId: string;
  displayName: string;
  avatarUrl?: string | null;
  enabled: boolean;
  isHost: boolean;
  prefs: RoomDevicePrefs;
}) {
  const ownId = useRef(peerId());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const names = useRef(new Map<string, { name: string; avatarUrl?: string | null }>());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<RoomPeer[]>([]);
  const [chat, setChat] = useState<RoomChatMessage[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [roomLocked, setRoomLockedState] = useState(false);
  const roomLockedRef = useRef(false);
  const [error, setError] = useState("");
  const [permission, setPermission] = useState<"pending" | "granted" | "denied">("pending");
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    roomLockedRef.current = roomLocked;
  }, [roomLocked]);

  const refreshDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    setAudioInputs(devices.filter((device) => device.kind === "audioinput"));
    setAudioOutputs(devices.filter((device) => device.kind === "audiooutput"));
    setVideoInputs(devices.filter((device) => device.kind === "videoinput"));
  }, []);

  const startMedia = useCallback(async (video: boolean) => {
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: prefs.micId ? { exact: prefs.micId } : undefined,
          noiseSuppression: prefs.noiseSuppression,
          echoCancellation: prefs.echoCancellation,
          autoGainControl: true,
        },
        video: video ? {
          deviceId: prefs.cameraId ? { exact: prefs.cameraId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        } : false,
      });
      const previous = streamRef.current;
      streamRef.current = next;
      setLocalStream(next);
      setPermission("granted");
      setError("");
      await refreshDevices();
      pcs.current.forEach((pc) => {
        next.getTracks().forEach((track) => {
          const sender = pc.getSenders().find((candidate) => candidate.track?.kind === track.kind);
          if (sender) void sender.replaceTrack(track);
          else pc.addTrack(track, next);
        });
      });
      previous?.getTracks().forEach((track) => track.stop());
    } catch {
      setPermission("denied");
      setError("Allow microphone and camera access to join.");
    }
  }, [prefs.cameraId, prefs.echoCancellation, prefs.micId, prefs.noiseSuppression, refreshDevices]);

  useEffect(() => {
    if (!enabled && !streamRef.current) void startMedia(false);
  }, [enabled, startMedia]);

  const removePeer = useCallback((remoteId: string) => {
    pcs.current.get(remoteId)?.close();
    pcs.current.delete(remoteId);
    names.current.delete(remoteId);
    setPeers((current) => current.filter((peer) => peer.peerId !== remoteId));
  }, []);

  const createPeer = useCallback((remoteId: string, channel: RealtimeChannel) => {
    const existing = pcs.current.get(remoteId);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    streamRef.current?.getTracks().forEach((track) => pc.addTrack(track, streamRef.current!));
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      void channel.send({
        type: "broadcast",
        event: "signal",
        payload: {
          from: ownId.current,
          to: remoteId,
          type: "ice",
          candidate: event.candidate.toJSON(),
        } satisfies Signal,
      });
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      const identity = names.current.get(remoteId);
      setPeers((current) => {
        const next = {
          peerId: remoteId,
          displayName: identity?.name ?? remoteId.slice(0, 8),
          avatarUrl: identity?.avatarUrl,
          stream,
        };
        return current.some((peer) => peer.peerId === remoteId)
          ? current.map((peer) => peer.peerId === remoteId ? { ...peer, ...next } : peer)
          : [...current, next];
      });
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(pc.connectionState)) removePeer(remoteId);
    };
    pc.ondatachannel = () => {};
    pcs.current.set(remoteId, pc);
    return pc;
  }, [removePeer]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const connect = async () => {
      if (!streamRef.current) await startMedia(false);
      if (cancelled) return;
      const channel = supabase.channel(`focus-room:${roomId}`, {
        config: { broadcast: { self: false } },
      });
      channel
        .on("broadcast", { event: "join" }, ({ payload }) => {
          const join = payload as { peerId?: string; name?: string; avatarUrl?: string | null };
          if (!join.peerId || join.peerId === ownId.current) return;
          if (roomLockedRef.current && !isHost) return;
          names.current.set(join.peerId, { name: join.name ?? join.peerId.slice(0, 8), avatarUrl: join.avatarUrl });
          setPeers((current) => current.some((peer) => peer.peerId === join.peerId)
            ? current
            : [...current, {
                peerId: join.peerId!,
                displayName: join.name ?? join.peerId!.slice(0, 8),
                avatarUrl: join.avatarUrl,
                stream: null,
              }]);
          const pc = createPeer(join.peerId, channel);
          void (async () => {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await channel.send({
              type: "broadcast",
              event: "signal",
              payload: {
                from: ownId.current,
                to: join.peerId!,
                type: "offer",
                sdp: offer,
                name: displayName,
                avatarUrl,
              } satisfies Signal,
            });
          })();
        })
        .on("broadcast", { event: "signal" }, ({ payload }) => {
          const signal = payload as Signal;
          if (!signal || (signal.to !== ownId.current && signal.to !== "*")) return;
          if (signal.name) {
            names.current.set(signal.from, { name: signal.name, avatarUrl: signal.avatarUrl });
            setPeers((current) => current.some((peer) => peer.peerId === signal.from)
              ? current.map((peer) => peer.peerId === signal.from
                  ? { ...peer, displayName: signal.name!, avatarUrl: signal.avatarUrl }
                  : peer)
              : [...current, {
                  peerId: signal.from,
                  displayName: signal.name!,
                  avatarUrl: signal.avatarUrl,
                  stream: null,
                }]);
          }
          if (signal.type === "room-lock") {
            setRoomLockedState(Boolean(signal.locked));
            return;
          }
          if (signal.type === "end-session") {
            setError("Session ended by host.");
            return;
          }
          if (signal.type === "mute") {
            const track = streamRef.current?.getAudioTracks()[0];
            if (track) track.enabled = false;
            setMicOn(false);
            setError("Muted by host.");
            return;
          }
          const pc = createPeer(signal.from, channel);
          void (async () => {
            try {
              if (signal.type === "offer" && signal.sdp) {
                if (pc.signalingState !== "stable") await pc.setLocalDescription({ type: "rollback" });
                await pc.setRemoteDescription(signal.sdp);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await channel.send({
                  type: "broadcast",
                  event: "signal",
                  payload: { from: ownId.current, to: signal.from, type: "answer", sdp: answer } satisfies Signal,
                });
              } else if (signal.type === "answer" && signal.sdp) {
                await pc.setRemoteDescription(signal.sdp);
              } else if (signal.type === "ice" && signal.candidate && pc.remoteDescription) {
                await pc.addIceCandidate(signal.candidate);
              }
            } catch (reason) {
              console.warn("[WebsiteFocusRoomRtc] signal", reason);
            }
          })();
        })
        .on("broadcast", { event: "leave" }, ({ payload }) => {
          const remoteId = (payload as { peerId?: string }).peerId;
          if (remoteId) removePeer(remoteId);
        })
        .on("broadcast", { event: "kick" }, ({ payload }) => {
          if ((payload as { to?: string }).to === ownId.current) setError("Removed from room by host.");
        })
        .on("broadcast", { event: "chat" }, ({ payload }) => {
          const message = payload as RoomChatMessage;
          if (message?.text || message?.attachment) {
            setChat((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
          }
        })
        .on("broadcast", { event: "chat-delete" }, ({ payload }) => {
          const id = (payload as { attachmentId?: string }).attachmentId;
          if (id) setChat((current) => current.filter((message) => message.attachment?.id !== id));
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.send({
              type: "broadcast",
              event: "join",
              payload: { peerId: ownId.current, name: displayName, avatarUrl },
            });
          }
        });
      channelRef.current = channel;
    };
    void connect();
    return () => {
      cancelled = true;
      const channel = channelRef.current;
      if (channel) {
        void channel.send({ type: "broadcast", event: "leave", payload: { peerId: ownId.current } });
        void supabase.removeChannel(channel);
      }
      channelRef.current = null;
      pcs.current.forEach((pc) => pc.close());
      pcs.current.clear();
      setPeers([]);
      setChat([]);
    };
  }, [avatarUrl, createPeer, displayName, enabled, isHost, removePeer, roomId, startMedia]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const sendChat = (text: string, attachment?: AttachmentRecord) => {
    const trimmed = text.trim();
    if (!trimmed && !attachment) return;
    const message: RoomChatMessage = {
      id: crypto.randomUUID(),
      from: ownId.current,
      name: displayName,
      text: trimmed,
      at: Date.now(),
      ...(attachment ? { attachment } : {}),
    };
    setChat((current) => [...current, message]);
    void channelRef.current?.send({ type: "broadcast", event: "chat", payload: message });
  };

  const removeChatAttachment = (attachmentId: string) => {
    setChat((current) => current.filter((message) => message.attachment?.id !== attachmentId));
    void channelRef.current?.send({ type: "broadcast", event: "chat-delete", payload: { attachmentId } });
  };

  const hostSignal = (to: string, type: Signal["type"], extra: Partial<Signal> = {}) => {
    if (!isHost) return;
    void channelRef.current?.send({
      type: "broadcast",
      event: type === "mute" ? "signal" : "signal",
      payload: { from: ownId.current, to, type, ...extra } satisfies Signal,
    });
  };

  return {
    localStream,
    participants: [
      ...(localStream ? [{ peerId: ownId.current, displayName: `${displayName} (you)`, avatarUrl, stream: localStream, isLocal: true }] : []),
      ...peers,
    ] as RoomPeer[],
    chat,
    sendChat,
    removeChatAttachment,
    micOn,
    camOn,
    error,
    permission,
    roomLocked,
    audioInputs,
    audioOutputs,
    videoInputs,
    toggleMic: () => {
      const track = streamRef.current?.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setMicOn(track.enabled);
      }
    },
    toggleCam: async () => {
      const next = !camOn;
      setCamOn(next);
      await startMedia(next);
    },
    selectMic: async (id: string) => {
      prefs.micId = id;
      await startMedia(camOn);
    },
    selectCamera: async (id: string) => {
      prefs.cameraId = id;
      setCamOn(true);
      await startMedia(true);
    },
    setRoomLock: (locked: boolean) => {
      if (!isHost) return;
      setRoomLockedState(locked);
      hostSignal("*", "room-lock", { locked });
    },
    mutePeer: (id: string) => hostSignal(id, "mute"),
    kickPeer: (id: string) => {
      if (!isHost) return;
      void channelRef.current?.send({ type: "broadcast", event: "kick", payload: { from: ownId.current, to: id } });
      removePeer(id);
    },
    endSession: () => hostSignal("*", "end-session"),
  };
}
