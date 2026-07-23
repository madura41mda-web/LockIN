import { supabase } from "../../supabaseClient";
import { optionalUuid } from "../../utils/idValidation";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Host-only: creates the room, inserts the generated questions, and seats the host as player 1.
export async function createBattleRoom({
  hostId,
  documentId,
  moduleName,
  difficulty,
  questionCount,
  timePerQuestion,
  isPrivate,
  questions,
}) {
  const battleCode = randomCode();
  const safeDocumentId = optionalUuid(documentId, "battle_rooms.document_id");

  const { data: room, error: roomError } = await supabase
    .from("battle_rooms")
    .insert({
      battle_code: battleCode,
      host_id: hostId,
      document_id: safeDocumentId,
      module_name: moduleName,
      difficulty,
      question_count: questionCount,
      time_per_question: timePerQuestion,
      question_type: "mcq",
      is_private: isPrivate,
      status: "waiting",
    })
    .select()
    .single();

  if (roomError) throw roomError;

  const questionRows = questions.map((q, index) => ({
    room_id: room.id,
    question_index: index,
    question_text: q.question,
    options: q.options,
    correct_answer: String(q.correctIndex),
    explanation: q.explanation || "",
    source_reference: q.page ? String(q.page) : null,
  }));

  const { error: qError } = await supabase.from("battle_questions").insert(questionRows);
  if (qError) throw qError;

  const { error: playerError } = await supabase.from("battle_players").insert({
    room_id: room.id,
    user_id: hostId,
    is_host: true,
    is_ready: true,
  });
  if (playerError) throw playerError;

  return room;
}

// Joins by code via a security-definer RPC (validates capacity, handles reconnect).
export async function joinBattleByCode(code) {
  const { data, error } = await supabase.rpc("join_battle", { p_code: code.trim().toUpperCase() });
  if (error) throw error;
  return data; // room id
}

export async function setReady(roomId, userId, isReady) {
  const { error } = await supabase
    .from("battle_players")
    .update({ is_ready: isReady, last_seen_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function startBattle(roomId) {
  const { error } = await supabase.rpc("start_battle", { p_room_id: roomId });
  if (error) throw error;
}

// Scoring happens server-side inside this RPC — the client never computes points itself.
export async function submitAnswer(roomId, questionIndex, selectedIndex) {
  const { data, error } = await supabase.rpc("submit_answer", {
    p_room_id: roomId,
    p_question_index: questionIndex,
    p_selected_answer: String(selectedIndex),
  });
  if (error) throw error;
  return data;
}

// Optimistic-concurrency advance — safe for both clients to call, only the first succeeds.
export async function advanceQuestion(roomId, expectedIndex) {
  const { error } = await supabase.rpc("advance_question", {
    p_room_id: roomId,
    p_expected_index: expectedIndex,
  });
  if (error) throw error;
}

export async function markConnected(roomId, userId) {
  await supabase
    .from("battle_players")
    .update({ is_connected: true, last_seen_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", userId);
}

export async function markDisconnected(roomId, userId) {
  await supabase
    .from("battle_players")
    .update({ is_connected: false })
    .eq("room_id", roomId)
    .eq("user_id", userId);
}
