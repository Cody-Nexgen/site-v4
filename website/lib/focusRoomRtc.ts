"use client";

/**
 * Website Focus Room RTC — thin adapter over the shared extension signaling stack.
 * Critical: /room/:id and /app Focus Rooms must use the same WS + Realtime protocol,
 * otherwise both can be "in room" in Supabase while never seeing each other.
 */

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useFocusRoomRtc } from "@focuz/lib/focusRoomRtc";
import type { AttachmentRecord } from "@/lib/attachmentApi";

export type RoomPeer = {
  peerId: string;
  displayName: string;
  avatarUrl?: string | null;
  stream: MediaStream | null;
  isLocal?: boolean;
  speaking?: boolean;
  mutedByHost?: boolean;
};

export type RoomChatMessage = {
  id: string;
  from: string;
  name: string;
  text: string;
  at: number;
  attachment?: AttachmentRecord;
};

export type RoomDevicePrefs = {
  micId: string;
  speakerId: string;
  cameraId: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
};

export function useWebsiteFocusRoomRtc({
  roomId,
  displayName,
  avatarUrl,
  enabled,
  isHost,
  prefs,
  accountUserId,
}: {
  roomId: string;
  displayName: string;
  avatarUrl?: string | null;
  enabled: boolean;
  isHost: boolean;
  prefs: RoomDevicePrefs;
  accountUserId?: string | null;
}) {
  const rtc = useFocusRoomRtc(
    supabase as never,
    enabled ? roomId : null,
    displayName,
    enabled,
    isHost,
    {
      micId: prefs.micId,
      speakerId: prefs.speakerId,
      cameraId: prefs.cameraId,
      noiseSuppression: prefs.noiseSuppression,
      echoCancellation: prefs.echoCancellation,
    },
    avatarUrl,
    accountUserId ?? null,
  );

  // Keep selected devices in sync when lobby prefs change before/while joining.
  useEffect(() => {
    if (!enabled || !prefs.micId) return;
    if (prefs.micId !== rtc.selectedMicId) void rtc.selectMic(prefs.micId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, prefs.micId]);

  useEffect(() => {
    if (!enabled || !prefs.cameraId) return;
    if (prefs.cameraId !== rtc.selectedCameraId) void rtc.selectCamera(prefs.cameraId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, prefs.cameraId]);

  useEffect(() => {
    if (!prefs.speakerId) return;
    if (prefs.speakerId !== rtc.selectedSpeakerId) rtc.selectSpeaker(prefs.speakerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.speakerId]);

  return {
    localStream: rtc.localStream,
    participants: rtc.participants as RoomPeer[],
    chat: rtc.chat as RoomChatMessage[],
    sendChat: rtc.sendChat,
    removeChatAttachment: rtc.removeChatAttachment,
    micOn: rtc.micOn,
    camOn: rtc.camOn,
    error: rtc.rtcError,
    permission: rtc.permissionState,
    roomLocked: rtc.roomLocked,
    audioInputs: rtc.audioInputs,
    audioOutputs: rtc.audioOutputs,
    videoInputs: rtc.videoInputs,
    selectedMicId: rtc.selectedMicId,
    selectedSpeakerId: rtc.selectedSpeakerId,
    selectedCameraId: rtc.selectedCameraId,
    toggleMic: rtc.toggleMic,
    toggleCam: rtc.toggleCam,
    selectMic: rtc.selectMic,
    selectSpeaker: rtc.selectSpeaker,
    selectCamera: rtc.selectCamera,
    setRoomLock: rtc.setRoomLock,
    mutePeer: rtc.mutePeer,
    kickPeer: rtc.kickPeer,
    endSession: rtc.endSession,
  };
}
