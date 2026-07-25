import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";

const CHAT_TOPIC = "lockin.lobby.chat";
const MAX_CHAT_MESSAGE_LENGTH = 1000;

function mapConnectionState(connectionState) {
  if (connectionState === ConnectionState.Connecting) return "connecting";
  if (
    connectionState === ConnectionState.Reconnecting ||
    connectionState === ConnectionState.SignalReconnecting
  ) {
    return "reconnecting";
  }
  if (connectionState === ConnectionState.Connected) return "connected";
  return "disconnected";
}

function microphoneErrorMessage(error) {
  const name = error?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      permissionState: "denied",
      message: "Microphone permission was denied. Allow microphone access in your browser and try again.",
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      permissionState: "unavailable",
      message: "No microphone was found. Connect a microphone and try again.",
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      permissionState: "unavailable",
      message: "Your microphone is unavailable or already in use by another app.",
    };
  }
  return {
    permissionState: "error",
    message: "The microphone could not be started. Check your device and try again.",
  };
}

function participantSnapshot(participant) {
  return {
    identity: participant.identity,
    name: participant.name || participant.identity || "Student",
    isLocal: participant.isLocal,
    microphoneEnabled: participant.isMicrophoneEnabled,
    isSpeaking: participant.isSpeaking,
    audioLevel: participant.audioLevel || 0,
  };
}

function snapshotParticipants(room) {
  if (!room || room.state === ConnectionState.Disconnected) return [];
  return [
    participantSnapshot(room.localParticipant),
    ...Array.from(room.remoteParticipants.values(), participantSnapshot),
  ];
}

function snapshotRemoteAudioTracks(room) {
  if (!room) return [];
  const tracks = [];
  for (const participant of room.remoteParticipants.values()) {
    for (const publication of participant.getTrackPublications()) {
      const track = publication.track;
      if (track?.kind !== Track.Kind.Audio) continue;
      tracks.push({
        id: publication.trackSid || track.sid || `${participant.identity}:audio`,
        participantIdentity: participant.identity,
        track,
      });
    }
  }
  return tracks;
}

function stopLocalMedia(room) {
  if (!room) return;
  for (const publication of room.localParticipant.audioTrackPublications.values()) {
    publication.track?.stop();
  }
}

function subscribeToRemoteMicrophones(room) {
  for (const participant of room.remoteParticipants.values()) {
    for (const publication of participant.getTrackPublications()) {
      if (
        publication.kind === Track.Kind.Audio &&
        publication.source === Track.Source.Microphone &&
        !publication.isSubscribed
      ) {
        publication.setSubscribed(true);
      }
    }
  }
}

export function useLobbyCommunication({ session, participantName }) {
  const [roomClient, setRoomClient] = useState(null);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [participants, setParticipants] = useState([]);
  const [remoteAudioTracks, setRemoteAudioTracks] = useState([]);
  const [microphoneEnabled, setMicrophoneEnabledState] = useState(false);
  const [microphoneBusy, setMicrophoneBusy] = useState(false);
  const [audioPermissionState, setAudioPermissionState] = useState("prompt");
  const [audioError, setAudioError] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatError, setChatError] = useState("");

  const roomRef = useRef(null);
  const roomIdRef = useRef(null);
  const connectPromiseRef = useRef(null);
  const connectionAttemptRef = useRef(0);
  const seenChatMessageIdsRef = useRef(new Set());
  const microphoneEnabledRef = useRef(false);

  const refreshCommunicationState = useCallback((room = roomRef.current) => {
    if (!room || roomRef.current !== room) return;
    setParticipants(snapshotParticipants(room));
    setRemoteAudioTracks(snapshotRemoteAudioTracks(room));
    const nextMicrophoneEnabled = room.localParticipant.isMicrophoneEnabled;
    microphoneEnabledRef.current = nextMicrophoneEnabled;
    setMicrophoneEnabledState(nextMicrophoneEnabled);
  }, []);

  const appendChatMessage = useCallback((message) => {
    if (!message?.id || seenChatMessageIdsRef.current.has(message.id)) return;
    seenChatMessageIdsRef.current.add(message.id);
    setChatMessages((current) =>
      [...current, message].sort((a, b) => a.timestamp - b.timestamp)
    );
  }, []);

  const clearSessionState = useCallback(() => {
    seenChatMessageIdsRef.current.clear();
    setChatMessages([]);
    setChatError("");
    setParticipants([]);
    setRemoteAudioTracks([]);
    microphoneEnabledRef.current = false;
    setMicrophoneEnabledState(false);
    setMicrophoneBusy(false);
    setAudioPermissionState("prompt");
    setAudioError("");
  }, []);

  const disconnect = useCallback(async ({ clearSession = true } = {}) => {
    connectionAttemptRef.current += 1;
    const activeRoom = roomRef.current;
    const disconnectedRoomId = roomIdRef.current;

    roomRef.current = null;
    roomIdRef.current = null;
    connectPromiseRef.current = null;
    setRoomClient(null);
    setActiveRoomId(null);

    if (activeRoom) {
      activeRoom.unregisterTextStreamHandler(CHAT_TOPIC);
      activeRoom.removeAllListeners();
      stopLocalMedia(activeRoom);
      await activeRoom.disconnect();
      console.info("LiveKit lobby disconnected:", { roomId: disconnectedRoomId });
    }

    setConnectionState("disconnected");
    if (clearSession) clearSessionState();
  }, [clearSessionState]);

  const connect = useCallback(async (nextRoom) => {
    const user = session?.user;
    if (!nextRoom?.id || !session?.access_token || !user) return;

    const activeRoom = roomRef.current;
    const sameRoom = roomIdRef.current === nextRoom.id;
    if (
      sameRoom &&
      activeRoom &&
      (connectPromiseRef.current ||
        activeRoom.state !== ConnectionState.Disconnected)
    ) {
      console.info("LiveKit lobby connection already active; reusing it:", {
        roomId: nextRoom.id,
        state: activeRoom.state,
      });
      return connectPromiseRef.current || Promise.resolve();
    }

    if (activeRoom) {
      await disconnect({ clearSession: !sameRoom });
    }

    const attemptId = ++connectionAttemptRef.current;
    const liveKitRoom = new Room();
    roomRef.current = liveKitRoom;
    roomIdRef.current = nextRoom.id;
    setRoomClient(liveKitRoom);
    setActiveRoomId(nextRoom.id);
    setConnectionState("connecting");
    setAudioError("");
    setChatError("");

    const refresh = () => refreshCommunicationState(liveKitRoom);
    liveKitRoom
      .on(RoomEvent.ConnectionStateChanged, (nextConnectionState) => {
        if (roomRef.current !== liveKitRoom) return;
        setConnectionState(mapConnectionState(nextConnectionState));
      })
      .on(RoomEvent.Connected, refresh)
      .on(RoomEvent.Reconnected, refresh)
      .on(RoomEvent.ParticipantConnected, refresh)
      .on(RoomEvent.ParticipantDisconnected, refresh)
      .on(RoomEvent.ParticipantNameChanged, refresh)
      .on(RoomEvent.ActiveSpeakersChanged, refresh)
      .on(RoomEvent.TrackPublished, (publication) => {
        if (
          publication.kind === Track.Kind.Audio &&
          publication.source === Track.Source.Microphone
        ) {
          try {
            publication.setSubscribed(true);
          } catch (error) {
            console.error("Failed to subscribe to a lobby microphone:", error);
          }
        }
        refresh();
      })
      .on(RoomEvent.TrackSubscribed, refresh)
      .on(RoomEvent.TrackUnsubscribed, refresh)
      .on(RoomEvent.TrackMuted, refresh)
      .on(RoomEvent.TrackUnmuted, refresh)
      .on(RoomEvent.LocalTrackPublished, refresh)
      .on(RoomEvent.LocalTrackUnpublished, refresh)
      .on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (!liveKitRoom.canPlaybackAudio) {
          setAudioError("Your browser paused room audio. Press the microphone button to resume audio.");
        }
      })
      .on(RoomEvent.MediaDevicesError, (error) => {
        const failure = microphoneErrorMessage(error);
        setAudioPermissionState(failure.permissionState);
        setAudioError(failure.message);
        refresh();
      })
      .on(RoomEvent.Disconnected, () => {
        if (roomRef.current !== liveKitRoom) return;
        stopLocalMedia(liveKitRoom);
        setConnectionState("disconnected");
        setRemoteAudioTracks([]);
        microphoneEnabledRef.current = false;
        setMicrophoneEnabledState(false);
      });

    liveKitRoom.registerTextStreamHandler(CHAT_TOPIC, (reader, sender) => {
      void (async () => {
        try {
          const body = (await reader.readAll()).trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
          if (!body) return;
          const senderParticipant = liveKitRoom.getParticipantByIdentity(sender.identity);
          const attributes = reader.info.attributes || {};
          appendChatMessage({
            id: attributes.messageId || reader.info.id,
            senderId: sender.identity,
            senderName:
              attributes.senderName ||
              senderParticipant?.name ||
              sender.identity ||
              "Student",
            body,
            timestamp: Number(attributes.sentAt) || reader.info.timestamp || Date.now(),
            isLocal: false,
          });
        } catch (error) {
          console.error("Failed to receive LiveKit lobby message:", error);
          setChatError("A live session message could not be received.");
        }
      })();
    });

    const connectPromise = (async () => {
      try {
        console.info("LiveKit lobby connection starting:", {
          roomId: nextRoom.id,
          attemptId,
        });
        const response = await fetch("/api/livekit-token", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomName: nextRoom.id,
            participantName,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Could not create a LiveKit session.");
        }
        if (!payload.token || !payload.url) {
          throw new Error("The LiveKit token response was incomplete.");
        }
        if (
          connectionAttemptRef.current !== attemptId ||
          roomRef.current !== liveKitRoom
        ) {
          return;
        }

        await liveKitRoom.connect(payload.url, payload.token, {
          autoSubscribe: false,
        });

        if (
          connectionAttemptRef.current !== attemptId ||
          roomRef.current !== liveKitRoom
        ) {
          liveKitRoom.unregisterTextStreamHandler(CHAT_TOPIC);
          liveKitRoom.removeAllListeners();
          stopLocalMedia(liveKitRoom);
          await liveKitRoom.disconnect();
          return;
        }

        setConnectionState("connected");
        subscribeToRemoteMicrophones(liveKitRoom);
        refreshCommunicationState(liveKitRoom);
        console.info("LiveKit lobby connected:", {
          roomId: nextRoom.id,
          attemptId,
        });
      } catch (error) {
        if (
          connectionAttemptRef.current !== attemptId ||
          roomRef.current !== liveKitRoom
        ) {
          return;
        }
        console.error("LiveKit lobby connection failed:", error);
        liveKitRoom.unregisterTextStreamHandler(CHAT_TOPIC);
        liveKitRoom.removeAllListeners();
        stopLocalMedia(liveKitRoom);
        await liveKitRoom.disconnect();
        roomRef.current = null;
        roomIdRef.current = null;
        setRoomClient(null);
        setActiveRoomId(null);
        setConnectionState("failed");
      }
    })();

    connectPromiseRef.current = connectPromise;
    try {
      await connectPromise;
    } finally {
      if (connectPromiseRef.current === connectPromise) {
        connectPromiseRef.current = null;
      }
    }
  }, [
    appendChatMessage,
    disconnect,
    participantName,
    refreshCommunicationState,
    session?.access_token,
    session?.user,
  ]);

  const setMicrophoneEnabled = useCallback(async (enabled) => {
    const liveKitRoom = roomRef.current;
    if (!liveKitRoom || liveKitRoom.state !== ConnectionState.Connected) {
      setAudioError("Voice is unavailable until the lobby connection is ready.");
      return false;
    }

    setMicrophoneBusy(true);
    setAudioError("");
    if (enabled) setAudioPermissionState("requesting");

    try {
      if (enabled) {
        await liveKitRoom.startAudio();
      }
      await liveKitRoom.localParticipant.setMicrophoneEnabled(enabled);
      microphoneEnabledRef.current = enabled;
      setMicrophoneEnabledState(enabled);
      if (enabled) setAudioPermissionState("granted");
      refreshCommunicationState(liveKitRoom);
      return true;
    } catch (error) {
      console.error("Failed to update the lobby microphone:", error);
      const failure = microphoneErrorMessage(error);
      setAudioPermissionState(failure.permissionState);
      setAudioError(failure.message);
      microphoneEnabledRef.current = false;
      setMicrophoneEnabledState(false);
      refreshCommunicationState(liveKitRoom);
      return false;
    } finally {
      setMicrophoneBusy(false);
    }
  }, [refreshCommunicationState]);

  const toggleMicrophone = useCallback(
    () => setMicrophoneEnabled(!microphoneEnabledRef.current),
    [setMicrophoneEnabled]
  );

  const sendChatMessage = useCallback(async (value) => {
    const body = String(value || "").trim();
    if (!body) return false;
    if (body.length > MAX_CHAT_MESSAGE_LENGTH) {
      setChatError(`Live session messages are limited to ${MAX_CHAT_MESSAGE_LENGTH} characters.`);
      return false;
    }

    const liveKitRoom = roomRef.current;
    if (!liveKitRoom || liveKitRoom.state !== ConnectionState.Connected) {
      setChatError("Live session chat is unavailable until the lobby connection is ready.");
      return false;
    }

    setChatError("");
    const messageId = crypto.randomUUID();
    const timestamp = Date.now();
    try {
      const info = await liveKitRoom.localParticipant.sendText(body, {
        topic: CHAT_TOPIC,
        attributes: {
          messageId,
          senderName: participantName || "Student",
          sentAt: String(timestamp),
        },
      });
      appendChatMessage({
        id: messageId || info.id,
        senderId: session?.user?.id || "",
        senderName: participantName || "Student",
        body,
        timestamp,
        isLocal: true,
      });
      return true;
    } catch (error) {
      console.error("Failed to send LiveKit lobby message:", error);
      setChatError("Your live session message could not be sent. Try again.");
      return false;
    }
  }, [appendChatMessage, participantName, session?.user?.id]);

  const handleDeviceChange = useCallback(async () => {
    if (!microphoneEnabledRef.current || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (devices.some((device) => device.kind === "audioinput")) return;
      await roomRef.current?.localParticipant.setMicrophoneEnabled(false).catch(() => {});
      microphoneEnabledRef.current = false;
      setMicrophoneEnabledState(false);
      setAudioPermissionState("unavailable");
      setAudioError("Your microphone was disconnected. Connect a microphone and enable it again.");
    } catch (error) {
      console.error("Failed to check microphone devices:", error);
    }
  }, []);

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [handleDeviceChange]);

  useEffect(
    () => () => {
      const activeRoom = roomRef.current;
      if (!activeRoom) return;
      activeRoom.unregisterTextStreamHandler(CHAT_TOPIC);
      activeRoom.removeAllListeners();
      stopLocalMedia(activeRoom);
      void activeRoom.disconnect();
      roomRef.current = null;
      roomIdRef.current = null;
    },
    []
  );

  return useMemo(
    () => ({
      room: roomClient,
      activeRoomId,
      connectionState,
      participantCount: participants.length,
      participants,
      remoteAudioTracks,
      microphoneEnabled,
      microphoneBusy,
      audioPermissionState,
      audioError,
      chatMessages,
      chatError,
      maxChatMessageLength: MAX_CHAT_MESSAGE_LENGTH,
      connect,
      disconnect,
      setMicrophoneEnabled,
      toggleMicrophone,
      sendChatMessage,
      setAudioError,
      setChatError,
    }),
    [
      activeRoomId,
      audioError,
      audioPermissionState,
      chatError,
      chatMessages,
      connect,
      connectionState,
      disconnect,
      microphoneBusy,
      microphoneEnabled,
      participants,
      remoteAudioTracks,
      roomClient,
      sendChatMessage,
      setMicrophoneEnabled,
      toggleMicrophone,
    ]
  );
}
