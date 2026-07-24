import { useCallback, useEffect, useState } from "react";
import { Swords, X } from "lucide-react";
import { supabase } from "../../supabaseClient";
import CreateBattleForm from "./createbattleform";
import JoinBattleForm from "./JoinBattleForm";
import WaitingRoom from "./WaitingRoom";
import BattleGame from "./BattleGame";
import BattleResults from "./battleresults";

export default function BattleMode({
  session,
  noteText,
  setNoteText,
  modules,
  selectedModule,
  setSelectedModule,
  displayModuleName,
  currentDocumentId,
  callGenerate,
  initialBattleCode,
  onClose,
  onFileRead,
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
      const { data, error } = await supabase.from("battle_rooms").select("*").eq("id", roomId).single();
      if (error) {
        console.error("Battle room load failed", {
          roomId,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        if (active) setError("Could not sync the battle room. Check your connection and retry.");
        return;
      }
      console.info("Battle room load result", {
        roomId,
        authenticatedUserId: userId,
        current_question_index: data?.current_question_index,
        round_phase: data?.round_phase,
        round_started_at: data?.round_started_at,
        round_ends_at: data?.round_ends_at,
        reveal_ends_at: data?.reveal_ends_at,
        status: data?.status,
      });
      if (active) setRoom(data);
    }
    async function loadPlayers() {
      console.info("Battle players refresh request", {
        file: "src/components/battle/BattleMode.jsx",
        query: "supabase.from('battle_players').select('*').eq('room_id', roomId).order('joined_at')",
        usesSharedSupabaseClient: true,
        supabaseUrl: supabase.supabaseUrl || "(unavailable)",
        roomId,
        authenticatedUserId: userId,
        hasSession: Boolean(session?.access_token),
      });

      let playersList = [];
      try {
        const { data, error: playersError } = await supabase.from("battle_players").select("*").eq("room_id", roomId).order("joined_at");
        console.info("Battle players refresh result", {
          roomId,
          authenticatedUserId: userId,
          rowCount: data?.length || 0,
          returnedErrorCode: playersError?.code || null,
          returnedErrorMessage: playersError?.message || null,
          returnedDetails: playersError?.details || null,
          returnedHint: playersError?.hint || null,
        });
        if (playersError) {
          console.error("Battle players load failed", {
            roomId,
            code: playersError.code,
            message: playersError.message,
            details: playersError.details,
            hint: playersError.hint,
          });
          return;
        }
        playersList = data || [];
      } catch (playersError) {
        console.error("Battle players refresh threw", {
          roomId,
          code: playersError.code,
          message: playersError.message,
          details: playersError.details,
          hint: playersError.hint,
          name: playersError.name,
          stack: playersError.stack,
        });
        return;
      }

      if (playersList && playersList.length > 0) {
        const uids = playersList.map((p) => p.user_id);
        const { data: profilesList, error: profilesError } = await supabase.from("profiles").select("*").in("id", uids);
        if (profilesError) {
          console.error("Battle profiles load failed; rendering players without profile extras", {
            roomId,
            code: profilesError.code,
            message: profilesError.message,
            details: profilesError.details,
            hint: profilesError.hint,
          });
        }
        
        const merged = playersList.map((p) => {
          const prof = (profilesList || []).find((pr) => pr.id === p.user_id);
          let extra = {};
          if (prof?.username && prof.username.startsWith("JSON:")) {
            try {
              extra = JSON.parse(prof.username.substring(5));
            } catch (e) {}
          }
          return {
            ...p,
            username: extra.username || prof?.username || "Player",
            avatar: extra.avatarChoice || prof?.avatar || "0",
            status: extra.status || prof?.status || ""
          };
        });
        if (active) setPlayers(merged);
      } else {
        if (active) setPlayers([]);
      }
    }

    loadRoom();
    loadPlayers();

    function reconcileBattle() {
      loadRoom();
      loadPlayers();
    }

    const channel = supabase
      .channel(`battle-room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "battle_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          console.info("Battle room realtime update received", {
            roomId,
            authenticatedUserId: userId,
            current_question_index: payload.new?.current_question_index,
            round_phase: payload.new?.round_phase,
            round_started_at: payload.new?.round_started_at,
            round_ends_at: payload.new?.round_ends_at,
            reveal_ends_at: payload.new?.reveal_ends_at,
            status: payload.new?.status,
          });
          if (active) setRoom(payload.new);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battle_players", filter: `room_id=eq.${roomId}` },
        () => loadPlayers()
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") reconcileBattle();
      });

    function handleFocus() {
      reconcileBattle();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") reconcileBattle();
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [roomId, session?.access_token, userId]);

  useEffect(() => {
    if (!roomId || !userId) return;

    console.info("Battle player connected update request", {
      file: "src/components/battle/BattleMode.jsx",
      query: "supabase.from('battle_players').update({ is_connected, last_seen_at }).eq('room_id', roomId).eq('user_id', userId)",
      usesSharedSupabaseClient: true,
      supabaseUrl: supabase.supabaseUrl || "(unavailable)",
      roomId,
      authenticatedUserId: userId,
    });
    supabase
      .from("battle_players")
      .update({ is_connected: true, last_seen_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .then(({ error }) => {
        if (error) {
          console.error("Battle player connected update failed", {
            roomId,
            authenticatedUserId: userId,
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
        }
      })
      .catch((error) => {
        console.error("Battle player connected update threw", {
          roomId,
          authenticatedUserId: userId,
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      });

    const heartbeat = setInterval(() => {
      console.info("Battle player heartbeat update request", {
        file: "src/components/battle/BattleMode.jsx",
        query: "supabase.from('battle_players').update({ last_seen_at }).eq('room_id', roomId).eq('user_id', userId)",
        usesSharedSupabaseClient: true,
        supabaseUrl: supabase.supabaseUrl || "(unavailable)",
        roomId,
        authenticatedUserId: userId,
      });
      supabase
        .from("battle_players")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .then(({ error }) => {
          if (error) {
            console.error("Battle player heartbeat update failed", {
              roomId,
              authenticatedUserId: userId,
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint,
            });
          }
        })
        .catch((error) => {
          console.error("Battle player heartbeat update threw", {
            roomId,
            authenticatedUserId: userId,
            name: error.name,
            message: error.message,
            stack: error.stack,
          });
        });
    }, 10000);

    function markDisconnected() {
      console.info("Battle player disconnected update request", {
        file: "src/components/battle/BattleMode.jsx",
        query: "supabase.from('battle_players').update({ is_connected }).eq('room_id', roomId).eq('user_id', userId)",
        usesSharedSupabaseClient: true,
        supabaseUrl: supabase.supabaseUrl || "(unavailable)",
        roomId,
        authenticatedUserId: userId,
      });
      supabase
        .from("battle_players")
        .update({ is_connected: false })
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .then(({ error }) => {
          if (error) {
            console.error("Battle player disconnected update failed", {
              roomId,
              authenticatedUserId: userId,
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint,
            });
          }
        })
        .catch((error) => {
          console.error("Battle player disconnected update threw", {
            roomId,
            authenticatedUserId: userId,
            name: error.name,
            message: error.message,
            stack: error.stack,
          });
        });
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

  const applyRoomSnapshot = useCallback((snapshot) => {
    if (!snapshot) return;
    setRoom((previousRoom) => {
      if (!previousRoom) return previousRoom;
      console.info("Battle applying RPC room snapshot", {
        roomId: previousRoom.id,
        previousQuestionIndex: previousRoom.current_question_index,
        nextQuestionIndex: snapshot.current_question_index,
        previousPhase: previousRoom.round_phase,
        nextPhase: snapshot.round_phase,
        status: snapshot.status,
      });
      return {
        ...previousRoom,
        ...snapshot,
      };
    });
  }, []);

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
      return <BattleGame room={room} myPlayer={myPlayer} opponent={opponent} userId={userId} onRoomSnapshot={applyRoomSnapshot} />;
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
          setNoteText={setNoteText}
          modules={modules}
          selectedModule={selectedModule}
          setSelectedModule={setSelectedModule}
          displayModuleName={displayModuleName}
          currentDocumentId={currentDocumentId}
          callGenerate={callGenerate}
          onBack={() => setStage("menu")}
          onCreated={handleRoomReady}
          onError={setError}
          onFileRead={onFileRead}
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
