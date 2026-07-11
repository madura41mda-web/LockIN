import { useEffect, useState } from "react";
import { Swords, X } from "lucide-react";
import { supabase } from "../../supabaseClient";
import CreateBattleForm from "./CreateBattleForm";
import JoinBattleForm from "./JoinBattleForm";
import WaitingRoom from "./WaitingRoom";
import BattleGame from "./BattleGame";
import BattleResults from "./BattleResults";

export default function BattleMode({
  session,
  noteText,
  displayModuleName,
  currentDocumentId,
  callGenerate,
  initialBattleCode,
  onClose,
}) {
  const [stage, setStage] = useState(initialBattleCode ? "join" : "menu"); // menu | create | join
  const [roomId, setRoomId] = useState(null);
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState("");

  const userId = session?.user?.id;

  useEffect(() => {
    if (!roomId) return;

    let active = true;

    async function loadRoom() {
      const { data } = await supabase.from("battle_rooms").select("*").eq("id", roomId).single();
      if (active) setRoom(data);
    }
    async function loadPlayers() {
      const { data } = await supabase.from("battle_players").select("*").eq("room_id", roomId).order("joined_at");
      if (active) setPlayers(data || []);
    }

    loadRoom();
    loadPlayers();

    const channel = supabase
      .channel(`battle-room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "battle_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          if (active) setRoom(payload.new);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battle_players", filter: `room_id=eq.${roomId}` },
        () => loadPlayers()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !userId) return;

    supabase
      .from("battle_players")
      .update({ is_connected: true, last_seen_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("user_id", userId);

    const heartbeat = setInterval(() => {
      supabase
        .from("battle_players")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("user_id", userId);
    }, 10000);

    function markDisconnected() {
      supabase.from("battle_players").update({ is_connected: false }).eq("room_id", roomId).eq("user_id", userId);
    }
    window.addEventListener("beforeunload", markDisconnected);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", markDisconnected);
      markDisconnected();
    };
  }, [roomId, userId]);

  function handleRoomReady(newRoomId) {
    setRoomId(newRoomId);
    setError("");
  }

  function leaveBattle() {
    setRoomId(null);
    setRoom(null);
    setPlayers([]);
    setStage("menu");
  }

  const myPlayer = players.find((p) => p.user_id === userId);
  const opponent = players.find((p) => p.user_id !== userId);

  if (roomId && room) {
    if (room.status === "completed") {
      return (
        <BattleResults
          room={room}
          players={players}
          myPlayer={myPlayer}
          opponent={opponent}
          onRematch={leaveBattle}
          onClose={onClose}
        />
      );
    }
    if (room.status === "in_progress") {
      return <BattleGame room={room} myPlayer={myPlayer} opponent={opponent} userId={userId} />;
    }
    return (
      <WaitingRoom
        room={room}
        players={players}
        myPlayer={myPlayer}
        userId={userId}
        onLeave={leaveBattle}
      />
    );
  }

  return (
    <main className="feature-page">
      <header className="feature-page-header">
        <div>
          <span className="setup-label">battle_page</span>
          <h3 className="feature-page-title">Battle Mode</h3>
          <p className="feature-page-copy">
            Challenge a friend to a live 1v1 quiz. Same questions, same timer, fastest correct answer wins the bonus.
          </p>
        </div>
        <div className="feature-page-icon" aria-hidden="true">
          <Swords size={28} />
        </div>
        <button type="button" className="secondary" onClick={onClose} aria-label="Close battle mode">
          <X size={20} />
        </button>
      </header>

      {error && <p className="mt-4 text-red-400 text-center mono">{error}</p>}

      {stage === "menu" && (
        <div className="battle-menu">
          <button type="button" className="generate-btn" onClick={() => setStage("create")}>
            Create Battle
          </button>
          <button type="button" className="secondary" style={{ width: "100%" }} onClick={() => setStage("join")}>
            Join Battle
          </button>
        </div>
      )}

      {stage === "create" && (
        <CreateBattleForm
          session={session}
          noteText={noteText}
          displayModuleName={displayModuleName}
          currentDocumentId={currentDocumentId}
          callGenerate={callGenerate}
          onBack={() => setStage("menu")}
          onCreated={handleRoomReady}
          onError={setError}
        />
      )}

      {stage === "join" && (
        <JoinBattleForm
          initialCode={initialBattleCode}
          onBack={() => setStage("menu")}
          onJoined={handleRoomReady}
          onError={setError}
        />
      )}
    </main>
  );
}