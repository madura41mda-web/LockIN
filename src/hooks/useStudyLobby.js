import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  createLobbyRoom,
  findLobbyRoom,
  loadLobbyState,
  markParticipantOffline,
  sendLobbyMessage,
  updateLobbyTimer,
  upsertParticipant,
} from "../services/studyLobbyService";

const LOBBY_STORAGE_KEY = "lockin_active_study_lobby";

function normalizeRoomCode(value) {
  return value.trim().toUpperCase();
}

function mapTimer(room) {
  return {
    status: room?.timer_status || "idle",
    durationSeconds: room?.timer_duration_seconds || 25 * 60,
    remainingSeconds: room?.timer_remaining_seconds || 25 * 60,
    startedAt: room?.timer_started_at || null,
    endsAt: room?.timer_ends_at || null,
  };
}

export function useStudyLobby({ session, profile, currentAction }) {
  const user = session?.user;
  const username = profile?.username || user?.email?.split("@")[0] || "Student";
  const avatar = profile?.avatarChoice || "0";
  const customStatus = profile?.status || "";

  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [timer, setTimer] = useState(mapTimer(null));
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const channelRef = useRef(null);

  const isHost = Boolean(room && user && room.host_user_id === user.id);
  const isInRoom = Boolean(room);

  const persistRoom = useCallback((nextRoom) => {
    if (!nextRoom || !user) return;
    localStorage.setItem(
      `${LOBBY_STORAGE_KEY}_${user.id}`,
      JSON.stringify({ roomId: nextRoom.id, code: nextRoom.code })
    );
  }, [user]);

  const clearPersistedRoom = useCallback(() => {
    if (user) localStorage.removeItem(`${LOBBY_STORAGE_KEY}_${user.id}`);
  }, [user]);

  const refreshState = useCallback(async (roomId) => {
    const state = await loadLobbyState(roomId);
    setRoom(state.room);
    setParticipants(state.participants);
    setMessages(state.messages);
    setTimer(mapTimer(state.room));
  }, []);

  const joinRoom = useCallback(async (code) => {
    if (!user) {
      setError("Sign in to create or join a secure study lobby.");
      return;
    }

    setStatus("joining");
    setError("");
    try {
      const nextRoom = await findLobbyRoom(normalizeRoomCode(code));
      await upsertParticipant({
        roomId: nextRoom.id,
        userId: user.id,
        username,
        avatar,
        customStatus,
        currentAction,
        isHost: nextRoom.host_user_id === user.id,
      });
      await refreshState(nextRoom.id);
      persistRoom(nextRoom);
      setStatus("joined");
    } catch (err) {
      console.error("Failed to join lobby:", err);
      setError("Could not join that room. Check the code or try again.");
      setStatus("idle");
    }
  }, [avatar, currentAction, customStatus, persistRoom, refreshState, user, username]);

  const createRoom = useCallback(async () => {
    if (!user) {
      setError("Sign in to create or join a secure study lobby.");
      return;
    }

    setStatus("creating");
    setError("");
    try {
      const nextRoom = await createLobbyRoom({ userId: user.id });
      await upsertParticipant({
        roomId: nextRoom.id,
        userId: user.id,
        username,
        avatar,
        customStatus,
        currentAction,
        isHost: true,
      });
      await refreshState(nextRoom.id);
      persistRoom(nextRoom);
      setStatus("joined");
    } catch (err) {
      console.error("Failed to create lobby:", err);
      setError("Could not create a room. Confirm the lobby migration is applied.");
      setStatus("idle");
    }
  }, [avatar, currentAction, customStatus, persistRoom, refreshState, user, username]);

  const leaveRoom = useCallback(async () => {
    const leavingRoomId = room?.id;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (leavingRoomId && user) {
      await markParticipantOffline({ roomId: leavingRoomId, userId: user.id });
    }
    setRoom(null);
    setParticipants([]);
    setMessages([]);
    setTimer(mapTimer(null));
    clearPersistedRoom();
    setStatus("idle");
  }, [clearPersistedRoom, room?.id, user]);

  const postMessage = useCallback(async (body) => {
    if (!room || !user) return;
    try {
      await sendLobbyMessage({ roomId: room.id, userId: user.id, username, body });
    } catch (err) {
      console.error("Failed to send lobby message:", err);
      setError("Message could not be sent.");
    }
  }, [room, user, username]);

  const setTimerState = useCallback(async (nextTimer) => {
    if (!room || !user || !isHost) return;
    setError("");
    try {
      const updatedRoom = await updateLobbyTimer({
        roomId: room.id,
        userId: user.id,
        status: nextTimer.status,
        durationSeconds: nextTimer.durationSeconds,
        remainingSeconds: nextTimer.remainingSeconds,
        startedAt: nextTimer.startedAt,
        endsAt: nextTimer.endsAt,
      });
      setRoom(updatedRoom);
      setTimer(mapTimer(updatedRoom));
    } catch (err) {
      console.error("Failed to update lobby timer:", err);
      setError("Only the host can update the shared timer.");
    }
  }, [isHost, room, user]);

  useEffect(() => {
    if (!user || room) return;
    const saved = localStorage.getItem(`${LOBBY_STORAGE_KEY}_${user.id}`);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.code) joinRoom(parsed.code);
    } catch (err) {
      console.error("Failed to restore lobby:", err);
      clearPersistedRoom();
    }
  }, [clearPersistedRoom, joinRoom, room, user]);

  useEffect(() => {
    if (!room || !user) return;

    upsertParticipant({
      roomId: room.id,
      userId: user.id,
      username,
      avatar,
      customStatus,
      currentAction,
      isHost,
    }).catch((err) => console.error("Failed to update participant state:", err));
  }, [avatar, currentAction, customStatus, isHost, room, user, username]);

  useEffect(() => {
    if (!room) return;
    const roomId = room.id;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`study-lobby-${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "study_lobby_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setError("This room was closed.");
            leaveRoom();
            return;
          }
          setRoom(payload.new);
          setTimer(mapTimer(payload.new));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "study_lobby_participants", filter: `room_id=eq.${roomId}` },
        () => refreshState(roomId).catch((err) => console.error("Failed to refresh participants:", err))
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "study_lobby_messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages((current) => {
            if (current.some((message) => message.id === payload.new.id)) return current;
            return [...current, payload.new].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          });
        }
      )
      .subscribe((nextStatus) => {
        if (nextStatus === "SUBSCRIBED") setStatus("joined");
        if (nextStatus === "CHANNEL_ERROR") setStatus("reconnecting");
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [leaveRoom, refreshState, room?.id]);

  useEffect(() => {
    if (!user) return;
    return () => {
      if (room?.id) markParticipantOffline({ roomId: room.id, userId: user.id });
    };
  }, [room?.id, user]);

  return useMemo(() => ({
    room,
    participants,
    messages,
    timer,
    status,
    error,
    isHost,
    isInRoom,
    createRoom,
    joinRoom,
    leaveRoom,
    postMessage,
    setTimerState,
    setError,
  }), [
    createRoom,
    error,
    isHost,
    isInRoom,
    joinRoom,
    leaveRoom,
    messages,
    participants,
    postMessage,
    room,
    setTimerState,
    status,
    timer,
  ]);
}
