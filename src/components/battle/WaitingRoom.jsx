import { useEffect, useState } from "react";
import { Copy, Crown, Loader2 } from "lucide-react";
import { setReady, startBattle } from "./battleApi";

export default function WaitingRoom({ room, players, myPlayer, userId, onLeave }) {
  const [copied, setCopied] = useState(false);
  const isHost = room.host_id === userId;
  const bothReady = players.length === 2 && players.every((p) => p.is_ready);
  const link = `${window.location.origin}/#/battle-join/${room.battle_code}`;

  // Auto-start shortly after both players are ready, so the host doesn't have to click.
  useEffect(() => {
    if (isHost && bothReady && room.status === "waiting") {
      const t = setTimeout(() => startBattle(room.id).catch(console.error), 1200);
      return () => clearTimeout(t);
    }
  }, [isHost, bothReady, room.status, room.id]);

  function toggleReady() {
    if (!myPlayer) return;
    setReady(room.id, userId, !myPlayer.is_ready).catch(console.error);
  }

  function copyLink() {
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="feature-page">
      <header className="feature-page-header">
        <div>
          <span className="setup-label">waiting_room</span>
          <h3 className="feature-page-title">{room.module_name || "Battle"}</h3>
          <p className="feature-page-copy">
            {room.question_count} questions · {room.difficulty} · {room.time_per_question}s each
          </p>
        </div>
      </header>

      <div className="quiz-setup">
        <div className="setup-section">
          <span className="setup-label">Invite</span>
          <div className="battle-code-display mono">{room.battle_code}</div>
          <button type="button" className="secondary" onClick={copyLink}>
            <Copy size={14} /> {copied ? "Copied!" : "Copy invite link"}
          </button>
        </div>

        <div className="setup-section">
          <span className="setup-label">Players</span>
          {players.map((p) => (
            <div key={p.id} className="battle-player-row">
              {p.is_host && <Crown size={14} />}
              <span>{p.user_id === userId ? "You" : "Opponent"}</span>
              <span className={p.is_ready ? "quiz-feedback-correct" : "mono"}>
                {p.is_ready ? "Ready" : "Not ready"}
              </span>
              {!p.is_connected && <span className="upload-error">disconnected</span>}
            </div>
          ))}
          {players.length < 2 && (
            <p className="mono" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Loader2 size={14} /> Waiting for opponent to join...
            </p>
          )}
        </div>

        <div className="nav-row">
          <button type="button" className="secondary" onClick={onLeave}>
            Leave
          </button>
          <button type="button" className="secondary" onClick={toggleReady} style={{ flex: 1 }}>
            {myPlayer?.is_ready ? "Not Ready" : "I'm Ready"}
          </button>
          {isHost && (
            <button
              type="button"
              className="generate-btn"
              onClick={() => startBattle(room.id).catch(console.error)}
              disabled={!bothReady}
              style={{ flex: 1 }}
            >
              Start Battle
            </button>
          )}
        </div>
      </div>
    </main>
  );
}