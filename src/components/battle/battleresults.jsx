import { useEffect, useState } from "react";
import { Trophy, RotateCcw, Home } from "lucide-react";
import { supabase } from "../../supabaseClient";

export default function BattleResults({ room, players, myPlayer, opponent, onRematch, onClose }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase.from("battle_results").select("*").eq("room_id", room.id).order("placement");
      if (!active) return;
      setResults(data || []);
      if ((data || []).length >= players.length) setLoading(false);
    }
    load();
    const interval = setInterval(load, 1500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [room.id, players.length]);

  const myResult = results.find((r) => r.player_id === myPlayer?.id);
  const opponentResult = results.find((r) => r.player_id === opponent?.id);
  const tied = myResult && opponentResult ? myResult.final_score === opponentResult.final_score : false;
  const won = myResult && opponentResult ? myResult.final_score > opponentResult.final_score : null;

  if (loading) {
    return (
      <main className="feature-page">
        <p className="mono text-center">Calculating results...</p>
      </main>
    );
  }

  return (
    <main className="feature-page">
      <div className="quiz-summary battle-victory">
        <Trophy
          size={40}
          style={{ color: tied ? "var(--text-muted)" : won ? "var(--accent)" : "var(--text-muted)", margin: "0 auto" }}
        />
        <p className="summary-title">{tied ? "It's a Tie!" : won ? "Victory!" : "Good Battle"}</p>

        <div className="summary-stats">
          <div className="summary-stat">
            <span className="summary-stat-value">{myResult?.final_score ?? 0}</span>
            <span className="summary-stat-label">You</span>
          </div>
          <div className="summary-stat">
            <span className="summary-stat-value">{opponentResult?.final_score ?? 0}</span>
            <span className="summary-stat-label">Opponent</span>
          </div>
        </div>

        <div className="summary-section">
          <div className="needs-practice-item">
            <span>Accuracy</span>
            <span>{myResult?.accuracy_pct ?? 0}%</span>
          </div>
          <div className="needs-practice-item">
            <span>Correct / Wrong</span>
            <span>
              {myResult?.correct_count ?? 0} / {myResult?.wrong_count ?? 0}
            </span>
          </div>
          <div className="needs-practice-item">
            <span>Avg Response Time</span>
            <span>{myResult ? (myResult.avg_response_time_ms / 1000).toFixed(1) : "0.0"}s</span>
          </div>
          <div className="needs-practice-item">
            <span>Fastest Answer</span>
            <span>{myResult?.fastest_answer_ms ? (myResult.fastest_answer_ms / 1000).toFixed(1) + "s" : "—"}</span>
          </div>
          <div className="needs-practice-item">
            <span>Best Streak</span>
            <span>{myResult?.max_streak ?? 0}</span>
          </div>
        </div>

        <div className="nav-row">
          <button type="button" className="secondary" onClick={onClose}>
            <Home size={16} /> Return Home
          </button>
          <button type="button" className="generate-btn" onClick={onRematch} style={{ flex: 1 }}>
            <RotateCcw size={16} /> Rematch
          </button>
        </div>
      </div>
    </main>
  );
}