import { supabase } from "../supabaseClient";

export function createRoomCode() {
  return `ROOM-${Math.floor(100000 + Math.random() * 900000)}`;
}

export async function createLobbyRoom({ userId }) {
  const code = createRoomCode();
  const { data, error } = await supabase
    .from("study_lobby_rooms")
    .insert({
      code,
      host_user_id: userId,
      status: "active",
      timer_status: "idle",
      timer_duration_seconds: 25 * 60,
      timer_remaining_seconds: 25 * 60,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function findLobbyRoom(code) {
  const { data, error } = await supabase
    .from("study_lobby_rooms")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .eq("status", "active")
    .single();

  if (error) throw error;
  return data;
}

export async function upsertParticipant({ roomId, userId, username, avatar, customStatus, currentAction, isHost }) {
  const { data, error } = await supabase
    .from("study_lobby_participants")
    .upsert(
      {
        room_id: roomId,
        user_id: userId,
        username,
        avatar,
        custom_status: customStatus,
        current_action: currentAction,
        is_host: isHost,
        is_online: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "room_id,user_id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function markParticipantOffline({ roomId, userId }) {
  if (!roomId || !userId) return;
  await supabase
    .from("study_lobby_participants")
    .update({ is_online: false, last_seen_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", userId);
}

export async function loadLobbyState(roomId) {
  const [roomResult, participantsResult, messagesResult] = await Promise.all([
    supabase.from("study_lobby_rooms").select("*").eq("id", roomId).single(),
    supabase
      .from("study_lobby_participants")
      .select("*")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("study_lobby_messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(100),
  ]);

  if (roomResult.error) throw roomResult.error;
  return {
    room: roomResult.data,
    participants: participantsResult.data || [],
    messages: messagesResult.data || [],
  };
}

export async function sendLobbyMessage({ roomId, userId, username, body }) {
  const cleanBody = body.trim();
  if (!cleanBody) return null;

  const { data, error } = await supabase
    .from("study_lobby_messages")
    .insert({ room_id: roomId, user_id: userId, username, body: cleanBody })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateLobbyTimer({ roomId, userId, status, durationSeconds, remainingSeconds, startedAt, endsAt }) {
  const { data, error } = await supabase.rpc("update_study_lobby_timer", {
    p_room_id: roomId,
    p_user_id: userId,
    p_status: status,
    p_duration_seconds: durationSeconds,
    p_remaining_seconds: remainingSeconds,
    p_started_at: startedAt,
    p_ends_at: endsAt,
  });

  if (error) throw error;
  return data;
}
