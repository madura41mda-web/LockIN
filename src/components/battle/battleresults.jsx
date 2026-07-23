import { useEffect, useState } from "react";
import { Trophy, RotateCcw, Home, Smile } from "lucide-react";
import { supabase } from "../../supabaseClient";
import Avatar from "../Avatar";

export default function BattleResults({ room, players, myPlayer, myResult: initialMyResult, opponent, onRematch, onClose }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [particles, setParticles] = useState([]);

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

  // Manage Web Audio results arpeggio chords
  function playResultsSound(isVictory) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      
      if (isVictory) {
        // C4 -> E4 -> G4 -> C5 triumph arpeggio
        const notes = [261.63, 329.63, 392.00, 523.25];
        notes.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          
          gain.gain.setValueAtTime(0, now + idx * 0.12);
          gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.12 + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.4);
          
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.5);
        });
      } else {
        // G4 -> Eb4 -> C4 sad arpeggio
        const notes = [392.00, 311.13, 261.63];
        notes.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + idx * 0.15);
          
          gain.gain.setValueAtTime(0, now + idx * 0.15);
          gain.gain.linearRampToValueAtTime(0.1, now + idx * 0.15 + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.5);
          
          osc.start(now + idx * 0.15);
          osc.stop(now + idx * 0.15 + 0.6);
        });
      }
    } catch (e) {
      console.error("Audio synth error:", e);
    }
  }

  // Trigger sound and confetti
  useEffect(() => {
    if (!loading) {
      if (won) {
        // Spawn colored confetti
        const colors = ["#ffb454", "#ea580c", "#38bdf8", "#4ade80", "#ec4899", "#a855f7"];
        const parts = Array.from({ length: 60 }).map((_, i) => ({
          id: i,
          color: colors[Math.floor(Math.random() * colors.length)],
          left: Math.random() * 100,
          delay: Math.random() * 1.5,
          size: Math.random() * 8 + 6,
          spin: Math.random() * 360,
        }));
        setParticles(parts);
        playResultsSound(true);
      } else {
        playResultsSound(false);
      }
    }
  }, [loading, won]);

  if (loading) {
    return (
      <main className="feature-page">
        <p className="mono text-center">Calculating results...</p>
      </main>
    );
  }

  return (
    <main className="feature-page relative" style={{ maxWidth: "36rem" }}>
      {/* Confetti styles & nodes */}
      <style>{`
        @keyframes confettiFall {
          0% {
            transform: translateY(-50px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(105vh) rotate(360deg);
            opacity: 0;
          }
        }
        .confetti-particle {
          position: fixed;
          top: -20px;
          z-index: 9999;
          pointer-events: none;
          animation: confettiFall 3s linear forwards;
        }
      `}</style>

      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.spin}deg)`,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
          }}
        />
      ))}

      <div className="quiz-summary battle-victory p-6 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d]">
        <div className="flex flex-col items-center gap-3">
          <div className="p-4 bg-orange-500/10 text-orange-500 rounded-full">
            <Trophy size={48} className={won ? "animate-bounce" : "text-gray-500"} />
          </div>
          <p className="summary-title text-2xl font-bold tracking-tight">
            {tied ? "It's a Tie!" : won ? "Victory!" : "Good Battle"}
          </p>
        </div>

        {/* Players details card */}
        <div className="grid grid-cols-2 gap-4 my-6">
          <div className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/[0.02] flex flex-col items-center gap-2">
            <Avatar choice={myPlayer?.avatar} size={48} />
            <span className="text-xs font-bold text-slate-900 dark:text-white">You</span>
            <span className="text-2xl font-bold font-mono text-orange-500">{myResult?.final_score ?? 0}</span>
          </div>

          <div className="p-4 rounded-xl border border-gray-250 dark:border-white/5 bg-[#171c25]/30 flex flex-col items-center gap-2">
            <Avatar choice={opponent?.avatar} size={48} />
            <span className="text-xs font-bold text-slate-900 dark:text-white">{opponent?.username || "Opponent"}</span>
            <span className="text-2xl font-bold font-mono text-slate-500">{opponentResult?.final_score ?? 0}</span>
          </div>
        </div>

        <div className="summary-section border-t border-gray-250 dark:border-white/10 pt-4 flex flex-col gap-2.5">
          <div className="needs-practice-item text-xs flex justify-between items-center py-1">
            <span className="text-gray-500 font-mono">Accuracy</span>
            <span className="font-bold text-slate-900 dark:text-white">{myResult?.accuracy_pct ?? 0}%</span>
          </div>
          <div className="needs-practice-item text-xs flex justify-between items-center py-1">
            <span className="text-gray-500 font-mono">Correct / Wrong</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {myResult?.correct_count ?? 0} / {myResult?.wrong_count ?? 0}
            </span>
          </div>
          <div className="needs-practice-item text-xs flex justify-between items-center py-1">
            <span className="text-gray-500 font-mono">Avg Response Time</span>
            <span className="font-bold text-slate-900 dark:text-white">{myResult ? (myResult.avg_response_time_ms / 1000).toFixed(1) : "0.0"}s</span>
          </div>
          <div className="needs-practice-item text-xs flex justify-between items-center py-1">
            <span className="text-gray-500 font-mono">Fastest Answer</span>
            <span className="font-bold text-slate-900 dark:text-white">{myResult?.fastest_answer_ms ? (myResult.fastest_answer_ms / 1000).toFixed(1) + "s" : "—"}</span>
          </div>
          <div className="needs-practice-item text-xs flex justify-between items-center py-1">
            <span className="text-gray-500 font-mono">Best Streak</span>
            <span className="font-bold text-slate-900 dark:text-white">{myResult?.max_streak ?? 0}</span>
          </div>
        </div>

        <div className="nav-row mt-6 pt-4 border-t border-gray-250 dark:border-white/10 flex gap-2">
          <button type="button" className="secondary w-full py-2 flex items-center justify-center gap-1.5 font-semibold text-xs" onClick={onClose}>
            <Home size={14} /> Return Home
          </button>
          <button type="button" className="generate-btn w-full py-2 flex items-center justify-center gap-1.5 font-semibold text-xs" onClick={onRematch} style={{ flex: 1 }}>
            <RotateCcw size={14} /> Rematch
          </button>
        </div>
      </div>
    </main>
  );
}